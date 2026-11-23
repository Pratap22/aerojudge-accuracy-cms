import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  toast,
} from '@aero-judge/ui';
import { padPilotNumber, parseFeedRanking, placeLabel, type FeedRankingBoard } from '@aero-judge/utils';
import { ApiError, api, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { connectSocket, onSocketEvent, onSocketReconnect } from '../lib/socket';

type FeedKind = 'TEXT' | 'SCORE' | 'PHOTO' | 'REFLIGHT';
type ComposerKind = 'TEXT' | 'SCORE' | 'PHOTO' | 'RESULT';

interface FeedItem {
  id: string;
  kind: FeedKind;
  body: string;
  imageUrl: string | null;
  pilotPhotoUrl: string | null;
  pilotNumber: number | null;
  pilotName: string | null;
  scoreText: string | null;
  roundNumber: number | null;
  caption: string | null;
  reason: string | null;
  createdAt: string;
}

interface StandingRow {
  id: string;
  rank: number;
  name: string;
  pilotNumber: number | null;
  teamName: string | null;
  scoreText: string;
  countryCode: string | null;
  photoUrl: string | null;
}

interface Standings {
  overall: StandingRow[];
  team: StandingRow[];
}

interface PilotOption {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
}

const KINDS: { id: ComposerKind; label: string }[] = [
  { id: 'TEXT', label: 'Text' },
  { id: 'SCORE', label: 'Score' },
  { id: 'PHOTO', label: 'Photo' },
  { id: 'RESULT', label: 'Result' },
];

function ceremonyRows(rows: StandingRow[]): { podium: StandingRow[]; rest: StandingRow[] } {
  const podium = [3, 2, 1].flatMap((place) => rows.filter((row) => row.rank === place));
  const rest = rows.filter((row) => row.rank !== 1 && row.rank !== 2 && row.rank !== 3);
  return { podium, rest };
}

function StandingList({
  title,
  rows,
  board,
  postingId,
  onPost,
}: {
  title: string;
  rows: StandingRow[];
  board: FeedRankingBoard;
  postingId: string | null | undefined;
  onPost: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {rows.map((row) => {
        const detail = [board === 'OVERALL' ? row.teamName : null, row.scoreText].filter(Boolean).join(' · ');
        return (
          <div key={row.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            <span className="w-12 shrink-0 text-sm font-semibold">{placeLabel(row.rank, 'badge')}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {row.pilotNumber != null ? `#${padPilotNumber(row.pilotNumber)} ` : ''}
                {row.name}
              </p>
              {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
            </div>
            <Button type="button" size="sm" disabled={postingId === row.id} onClick={() => onPost(row.id)}>
              {postingId === row.id ? 'Posting…' : 'Post'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function FeedItemMeta({ item }: { item: FeedItem }) {
  const ranking = parseFeedRanking(item.caption);
  if (ranking && item.roundNumber != null) {
    const place = `${placeLabel(item.roundNumber)} ${ranking.board === 'TEAM' ? 'team' : 'overall'}`;
    return (
      <>
        {place}
        {item.pilotNumber != null ? ` · Pilot ${padPilotNumber(item.pilotNumber)}` : ''}
        {item.pilotName ? ` · ${item.pilotName}` : ''}
        {ranking.board === 'OVERALL' && item.reason ? ` · ${item.reason}` : ''}
        {item.scoreText ? ` · ${item.scoreText}` : ''}
      </>
    );
  }
  return (
    <>
      {item.kind === 'SCORE'
        ? 'Score'
        : item.kind === 'REFLIGHT'
          ? 'Reflight'
          : item.kind === 'TEXT'
            ? 'Text'
            : 'Photo'}
      {item.pilotNumber != null ? ` · Pilot ${padPilotNumber(item.pilotNumber)}` : ''}
      {item.pilotName ? ` · ${item.pilotName}` : ''}
      {item.scoreText ? ` · ${item.scoreText}` : ''}
      {item.roundNumber != null ? ` · Round ${item.roundNumber}` : ''}
    </>
  );
}

function pilotOptionLabel(pilot: PilotOption): string {
  const number = String(pilot.pilotNumber).padStart(3, '0');
  return `${number} · ${pilot.firstName} ${pilot.lastName}`.trim();
}

export function EventFeedPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ComposerKind>('TEXT');
  const [board, setBoard] = useState<FeedRankingBoard>('OVERALL');
  const [pilotId, setPilotId] = useState('');
  const [message, setMessage] = useState('');
  const [scoreText, setScoreText] = useState('');
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: competition } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => api.get<{ status: string }>(`/competitions/${competitionId}`),
    enabled: Boolean(competitionId),
  });
  const resultsEnabled = competition?.status === 'COMPLETED';

  useEffect(() => {
    if (!resultsEnabled && kind === 'RESULT') setKind('TEXT');
  }, [resultsEnabled, kind]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['event-feed', competitionId],
    queryFn: () => api.get<FeedItem[]>(`/competitions/${competitionId}/feed`),
    enabled: Boolean(competitionId),
  });

  const { data: pilots = [] } = useQuery({
    queryKey: ['pilots', competitionId, 'feed-picker'],
    queryFn: () => api.get<PilotOption[]>(`/competitions/${competitionId}/pilots`, { pageSize: 200 }),
    enabled: Boolean(competitionId),
  });

  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ['event-feed-standings', competitionId],
    queryFn: () => api.get<Standings>(`/competitions/${competitionId}/feed/standings`),
    enabled: Boolean(competitionId) && resultsEnabled && kind === 'RESULT',
    refetchInterval: 30_000,
  });

  const standingRows = board === 'TEAM' ? standings?.team ?? [] : standings?.overall ?? [];
  const { podium, rest } = useMemo(() => ceremonyRows(standingRows), [standingRows]);

  const sortedPilots = useMemo(
    () => [...pilots].sort((a, b) => a.pilotNumber - b.pilotNumber),
    [pilots],
  );

  useEffect(() => {
    if (!competitionId) return;
    connectSocket(competitionId);
    const unsub = onSocketEvent('feed:updated', (payload) => {
      if (payload.competitionId !== competitionId) return;
      void queryClient.invalidateQueries({ queryKey: ['event-feed', competitionId] });
    });
    const unsubReconnect = onSocketReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['event-feed', competitionId] });
    });
    return () => {
      unsub();
      unsubReconnect();
    };
  }, [competitionId, queryClient]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['event-feed', competitionId] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!competitionId) throw new Error('Competition is required');
      if (kind === 'TEXT') {
        return api.post<FeedItem>(`/competitions/${competitionId}/feed/text`, {
          body: message.trim(),
        });
      }
      if (kind === 'PHOTO') {
        if (!photo) throw new Error('Choose a photo');
        const formData = new FormData();
        formData.append('photo', photo);
        formData.append('caption', caption.trim());
        return apiRequest<FeedItem>(`/competitions/${competitionId}/feed/photo`, {
          method: 'POST',
          formData,
        });
      }
      if (!pilotId) throw new Error('Choose a pilot');
      return api.post<FeedItem>(`/competitions/${competitionId}/feed/score`, {
        pilotId,
        scoreText: scoreText.trim(),
      });
    },
    onSuccess: async () => {
      setMessage('');
      setScoreText('');
      setCaption('');
      setPhoto(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      toast({ title: 'Posted to the event feed' });
      await refresh();
    },
    onError: (error) => {
      const message = error instanceof ApiError || error instanceof Error ? error.message : 'Could not post';
      toast({ title: 'Could not post', description: message, variant: 'destructive' });
    },
  });

  const rankingMutation = useMutation({
    mutationFn: (id: string) => {
      if (!competitionId) throw new Error('Competition is required');
      return api.post<FeedItem>(`/competitions/${competitionId}/feed/ranking`, { board, id });
    },
    onSuccess: async () => {
      toast({ title: 'Posted to the event feed' });
      await refresh();
    },
    onError: (error) => {
      const message = error instanceof ApiError || error instanceof Error ? error.message : 'Could not post';
      toast({ title: 'Could not post', description: message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/competitions/${competitionId}/feed/${itemId}`),
    onSuccess: async () => {
      setPendingDeleteId(null);
      toast({ title: 'Removed from the feed' });
      await refresh();
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Could not remove that post';
      toast({ title: 'Could not remove that post', description: message, variant: 'destructive' });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (kind === 'RESULT') return;
    createMutation.mutate();
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Event feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {resultsEnabled
            ? 'Post a note, a score, a photo, or a place from the overall or team list.'
            : 'Post a note, a score, or a photo. Overall and team places can be posted once the competition is completed.'}{' '}
          Emojis are kept in the text and captions. Scores and reflights saved from Enter scores
          appear here with the pilot, result, and reflight reason.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New post</CardTitle>
          <CardDescription>Chief judge and super admin only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-wrap gap-2">
              {(resultsEnabled ? KINDS : KINDS.filter((option) => option.id !== 'RESULT')).map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={kind === option.id ? 'default' : 'outline'}
                  onClick={() => setKind(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {kind === 'SCORE' ? (
              <div className="grid gap-2">
                <Label htmlFor="feed-pilot">Pilot</Label>
                <select
                  id="feed-pilot"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pilotId}
                  onChange={(event) => setPilotId(event.target.value)}
                  required
                >
                  <option value="">Select a pilot</option>
                  {sortedPilots.map((pilot) => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilotOptionLabel(pilot)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {kind === 'TEXT' ? (
              <div className="grid gap-2">
                <Label htmlFor="feed-text">Text</Label>
                <Textarea
                  id="feed-text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Round 2 is open 🎯"
                  maxLength={1000}
                  rows={4}
                  required
                />
              </div>
            ) : null}

            {kind === 'SCORE' ? (
              <div className="grid gap-2">
                <Label htmlFor="feed-score">Score</Label>
                <Input
                  id="feed-score"
                  value={scoreText}
                  onChange={(event) => setScoreText(event.target.value)}
                  placeholder="45 cm"
                  maxLength={120}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Shown with the pilot number, name, and photo when one is on file.
                </p>
              </div>
            ) : null}

            {kind === 'RESULT' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={board === 'OVERALL' ? 'default' : 'outline'}
                    onClick={() => setBoard('OVERALL')}
                  >
                    Overall
                  </Button>
                  <Button
                    type="button"
                    variant={board === 'TEAM' ? 'default' : 'outline'}
                    onClick={() => setBoard('TEAM')}
                  >
                    Team
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Post one place at a time. The podium is listed 3rd, then 2nd, then 1st.
                  {board === 'OVERALL' ? ' Each overall result includes the pilot’s team.' : ''}
                </p>
                {standingsLoading ? <p className="text-sm text-muted-foreground">Loading the list…</p> : null}
                {!standingsLoading && standingRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No {board === 'TEAM' ? 'team' : 'overall'} standings yet. Enter scores, then recalculate
                    rankings.
                  </p>
                ) : null}
                {podium.length > 0 ? (
                  <StandingList
                    title="Podium"
                    rows={podium}
                    board={board}
                    postingId={rankingMutation.isPending ? rankingMutation.variables : null}
                    onPost={(id) => rankingMutation.mutate(id)}
                  />
                ) : null}
                {rest.length > 0 ? (
                  <StandingList
                    title={podium.length > 0 ? 'The rest of the list' : 'Standings'}
                    rows={rest}
                    board={board}
                    postingId={rankingMutation.isPending ? rankingMutation.variables : null}
                    onPost={(id) => rankingMutation.mutate(id)}
                  />
                ) : null}
              </div>
            ) : null}

            {kind === 'PHOTO' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="feed-photo">Photo</Label>
                  <Input
                    id="feed-photo"
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                    onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG, WebP, or iPhone HEIC. HEIC photos are converted before they are stored.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="feed-caption">Caption</Label>
                  <Textarea
                    id="feed-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Target set for round 2 🏁"
                    maxLength={1000}
                    required
                  />
                </div>
              </>
            ) : null}

            {kind !== 'RESULT' ? (
            <div>
              <Button type="submit" disabled={createMutation.isPending || !competitionId}>
                {kind === 'PHOTO' ? <ImagePlus className="mr-2 h-4 w-4" /> : null}
                {createMutation.isPending ? 'Posting…' : 'Post to feed'}
              </Button>
            </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published posts</CardTitle>
          <CardDescription>Newest first. Removing a post takes it off the public pages.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading feed…</p> : null}
          {!isLoading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : null}
          {items.map((item) => (
            <article key={item.id} className="flex gap-4 rounded-lg border p-3">
              {item.kind === 'PHOTO' && item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-md object-cover"
                />
              ) : item.pilotPhotoUrl ? (
                <img
                  src={item.pilotPhotoUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm font-medium">{item.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <FeedItemMeta item={item} />
                  {' · '}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              {pendingDeleteId === item.id ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(item.id)}
                  >
                    Confirm
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPendingDeleteId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove post"
                  onClick={() => setPendingDeleteId(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
