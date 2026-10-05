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
import { ApiError, api, apiRequest } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { getSocket, onSocketEvent } from '../lib/socket';

type FeedKind = 'TEXT' | 'SCORE' | 'PHOTO' | 'REFLIGHT';
type ComposerKind = 'TEXT' | 'SCORE' | 'PHOTO';

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
  createdAt: string;
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
];

function pilotOptionLabel(pilot: PilotOption): string {
  const number = String(pilot.pilotNumber).padStart(3, '0');
  return `${number} · ${pilot.firstName} ${pilot.lastName}`.trim();
}

export function EventFeedPage() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ComposerKind>('TEXT');
  const [pilotId, setPilotId] = useState('');
  const [message, setMessage] = useState('');
  const [scoreText, setScoreText] = useState('');
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  const sortedPilots = useMemo(
    () => [...pilots].sort((a, b) => a.pilotNumber - b.pilotNumber),
    [pilots],
  );

  useEffect(() => {
    if (!competitionId) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('join:competition', competitionId);
    return onSocketEvent('feed:updated', (payload) => {
      if (payload.competitionId !== competitionId) return;
      void queryClient.invalidateQueries({ queryKey: ['event-feed', competitionId] });
    });
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
    createMutation.mutate();
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Event feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Post a note, a score, or a photo. Emojis are kept in the text and captions. Scores and
          reflights saved from Enter scores appear here with the pilot, result, and reflight reason.
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
              {KINDS.map((option) => (
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

            {kind === 'PHOTO' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="feed-photo">Photo</Label>
                  <Input
                    id="feed-photo"
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                    required
                  />
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

            <div>
              <Button type="submit" disabled={createMutation.isPending || !competitionId}>
                {kind === 'PHOTO' ? <ImagePlus className="mr-2 h-4 w-4" /> : null}
                {createMutation.isPending ? 'Posting…' : 'Post to feed'}
              </Button>
            </div>
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
                  {item.kind === 'SCORE'
                    ? 'Score'
                    : item.kind === 'REFLIGHT'
                      ? 'Reflight'
                      : item.kind === 'TEXT'
                        ? 'Text'
                        : 'Photo'}
                  {item.pilotNumber != null ? ` · Pilot ${item.pilotNumber}` : ''}
                  {item.pilotName ? ` · ${item.pilotName}` : ''}
                  {item.scoreText ? ` · ${item.scoreText}` : ''}
                  {item.roundNumber != null ? ` · Round ${item.roundNumber}` : ''}
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
