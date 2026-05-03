'use client';

import { Check, FileText, Loader2, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { updateRecipe } from '@/lib/actions/recipes';
import { cn } from '@/lib/utils';

interface RecipeInstructionsEditorProps {
  tenantId: string;
  recipeId: string;
  instructionsMd: string | null | undefined;
  videoUrl: string | null | undefined;
  canEdit: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src);
  const lines = escaped.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const ulMatch = /^\s*-\s+(.*)$/.exec(line);
    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);

    if (ulMatch && ulMatch[1] !== undefined) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul class="list-disc pr-6">');
        listType = 'ul';
      }
      out.push(`<li>${applyInline(ulMatch[1])}</li>`);
    } else if (olMatch && olMatch[1] !== undefined) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol class="list-decimal pr-6">');
        listType = 'ol';
      }
      out.push(`<li>${applyInline(olMatch[1])}</li>`);
    } else if (line === '') {
      closeList();
      out.push('<br/>');
    } else {
      closeList();
      out.push(`<p>${applyInline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}

function applyInline(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  if (!url) return null;
  const yt1 = /(?:youtube\.com\/watch\?[^#]*v=)([A-Za-z0-9_-]{6,})/.exec(url);
  if (yt1 && yt1[1]) return { provider: 'youtube', id: yt1[1] };
  const yt2 = /youtu\.be\/([A-Za-z0-9_-]{6,})/.exec(url);
  if (yt2 && yt2[1]) return { provider: 'youtube', id: yt2[1] };
  const ytEmbed = /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/.exec(url);
  if (ytEmbed && ytEmbed[1]) return { provider: 'youtube', id: ytEmbed[1] };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vm && vm[1]) return { provider: 'vimeo', id: vm[1] };
  return null;
}

export function RecipeInstructionsEditor({
  tenantId,
  recipeId,
  instructionsMd,
  videoUrl,
  canEdit,
}: RecipeInstructionsEditorProps) {
  const [text, setText] = useState(instructionsMd ?? '');
  const [savedText, setSavedText] = useState(instructionsMd ?? '');
  const [showSaved, setShowSaved] = useState(false);
  const [isAutoSaving, startAutoSave] = useTransition();
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [video, setVideo] = useState(videoUrl ?? '');
  const [savedVideo, setSavedVideo] = useState(videoUrl ?? '');
  const [videoError, setVideoError] = useState(false);
  const [isVideoSaving, startVideoSave] = useTransition();

  // Debounced auto-save for instructions
  useEffect(() => {
    if (!canEdit) return;
    if (text === savedText) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const value = text;
      startAutoSave(async () => {
        try {
          await updateRecipe(tenantId, recipeId, { instructionsMd: value });
          setSavedText(value);
          setShowSaved(true);
          if (fadeTimer.current) clearTimeout(fadeTimer.current);
          fadeTimer.current = setTimeout(() => setShowSaved(false), 2000);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
        }
      });
    }, 1500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [text, savedText, canEdit, tenantId, recipeId]);

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const previewHtml = useMemo(() => renderMarkdown(text), [text]);
  const parsedVideo = useMemo(() => parseVideoUrl(savedVideo), [savedVideo]);

  function handleVideoBlur() {
    const trimmed = video.trim();
    if (trimmed === savedVideo) return;

    if (trimmed === '') {
      setVideoError(false);
      startVideoSave(async () => {
        try {
          await updateRecipe(tenantId, recipeId, { videoUrl: null });
          setSavedVideo('');
          toast.success('הקישור הוסר');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
        }
      });
      return;
    }

    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setVideoError(true);
      return;
    }
    setVideoError(false);
    startVideoSave(async () => {
      try {
        await updateRecipe(tenantId, recipeId, { videoUrl: trimmed });
        setSavedVideo(trimmed);
        toast.success('הקישור נשמר');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
      }
    });
  }

  const embedSrc = parsedVideo
    ? parsedVideo.provider === 'youtube'
      ? `https://www.youtube.com/embed/${parsedVideo.id}`
      : `https://player.vimeo.com/video/${parsedVideo.id}`
    : null;

  return (
    <div className="flex flex-col gap-6 rounded-lg border p-4">
      {/* Instructions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h2 className="text-base font-semibold">הוראות הכנה</h2>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            {isAutoSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {showSaved && !isAutoSaving && (
              <span className="text-green-600 transition-opacity">
                <Check className="me-1 inline h-3 w-3" />
                נשמר
              </span>
            )}
          </div>
        </div>

        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">עריכה</TabsTrigger>
            <TabsTrigger value="preview">תצוגה מקדימה</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-3">
            <Textarea
              dir="rtl"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="כתוב כאן את הוראות ההכנה. ניתן להשתמש ב-**מודגש**, רשימות עם - או 1."
              className="min-h-[200px] resize-y text-start"
              disabled={!canEdit}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-3">
            <div
              dir="rtl"
              className="prose prose-sm min-h-[200px] max-w-none rounded-md border p-3 text-start"
              dangerouslySetInnerHTML={{
                __html: text.trim()
                  ? previewHtml
                  : '<p class="text-muted-foreground">אין תוכן להצגה</p>',
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Video */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4" />
          <Label htmlFor="video-url" className="text-base font-semibold">
            סרטון
          </Label>
          {isVideoSaving && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <Input
          id="video-url"
          dir="ltr"
          value={video}
          onChange={(e) => {
            setVideo(e.target.value);
            if (videoError) setVideoError(false);
          }}
          onBlur={handleVideoBlur}
          placeholder="הדבק קישור לסרטון YouTube או Vimeo"
          disabled={!canEdit}
          className={cn(videoError && 'border-red-500 focus-visible:ring-red-500')}
        />
        {videoError && <p className="text-xs text-red-600">קישור לא תקין</p>}
        {embedSrc && (
          <div
            className="mt-2 w-full overflow-hidden rounded-md border"
            style={{ aspectRatio: '16 / 9' }}
          >
            <iframe
              src={embedSrc}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="סרטון מתכון"
            />
          </div>
        )}
      </div>
    </div>
  );
}
