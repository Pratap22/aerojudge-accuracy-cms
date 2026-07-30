import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Send } from 'lucide-react';
import { Button, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@npha/ui';
import type { Announcement } from '../lib/types';

interface AnnouncementsPanelProps {
  announcements: Announcement[];
  onCompose: (title: string, body: string, priority: Announcement['priority']) => void;
}

const priorityColors: Record<Announcement['priority'], string> = {
  LOW: 'border-white/10',
  NORMAL: 'border-sky-500/30',
  HIGH: 'border-amber-500/40',
  URGENT: 'border-red-500/50 bg-red-500/10',
};

export function AnnouncementsPanel({ announcements, onCompose }: AnnouncementsPanelProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Announcement['priority']>('NORMAL');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    onCompose(title.trim(), body.trim(), priority);
    setTitle('');
    setBody('');
    setShowForm(false);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-tent-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-sky-400">Announcements</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((s) => !s)}
          className="border-white/20 text-white hover:bg-white/10"
        >
          {showForm ? 'Cancel' : 'Compose'}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSubmit}
            className="mb-4 space-y-3 overflow-hidden border-b border-white/10 pb-4"
          >
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-white/10 bg-tent-navy text-white"
            />
            <Textarea
              placeholder="Announcement body…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="border-white/10 bg-tent-navy text-white"
            />
            <Select value={priority} onValueChange={(v) => setPriority(v as Announcement['priority'])}>
              <SelectTrigger className="border-white/10 bg-tent-navy text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" className="w-full bg-sky-500 text-tent-navy hover:bg-sky-400">
              <Send className="mr-2 h-4 w-4" />
              Send Announcement
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {announcements.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">No announcements yet</p>
          ) : (
            announcements.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-lg border p-3 ${priorityColors[a.priority]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white">{a.title}</p>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/40">
                    {a.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/70">{a.body}</p>
                <p className="mt-2 text-[10px] text-white/30">
                  {new Date(a.createdAt).toLocaleTimeString()}
                </p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
