/* Supabase's generated Database type is updated after the new migration is applied. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, ExternalLink, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PushTarget = "all" | "student" | "teacher" | "class";
type ActionType = "none" | "store" | "internal" | "web";
type PushClass = { id: string; class_name: string; school_name: string; subscriber_count: number };
type PushMessage = {
  id: string; title: string; body: string; target: PushTarget; target_class_id: string | null;
  action_type: ActionType; action_value: string | null; scheduled_at: string; sent_at: string | null;
  status: string; attempted_count: number; success_count: number; failure_count: number; error: string | null;
  sent_count: number | null;
};

const statusLabels: Record<string, string> = {
  pending: "Geplant", processing: "Wird versendet", sent: "Gesendet",
  partially_failed: "Teilweise gesendet", failed: "Fehlgeschlagen", cancelled: "Abgebrochen",
};

const targetLabels: Record<PushTarget, string> = {
  all: "Alle Geräte", student: "Schüler", teacher: "Lehrkräfte", class: "Klasse",
};

export function PushAdmin() {
  const [title, setTitle] = useState("BOOST");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<PushTarget>("all");
  const [classId, setClassId] = useState("");
  const [actionType, setActionType] = useState<ActionType>("none");
  const [actionValue, setActionValue] = useState("");
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [classes, setClasses] = useState<PushClass[]>([]);
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedClass = useMemo(() => classes.find((item) => item.id === classId), [classes, classId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: classData, error: classError }, { data: messageData, error: messageError }] = await Promise.all([
      (supabase.rpc as any)("admin_list_push_classes"),
      (supabase as any).from("push_messages").select("id,title,body,target,target_class_id,action_type,action_value,scheduled_at,sent_at,status,attempted_count,success_count,failure_count,sent_count,error").order("created_at", { ascending: false }).limit(50),
    ]);
    if (classError || messageError) toast.error(classError?.message || messageError?.message || "Push-Daten konnten nicht geladen werden");
    setClasses((classData ?? []) as PushClass[]);
    setMessages((messageData ?? []) as PushMessage[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const validate = () => {
    if (!title.trim() || title.trim().length > 80) return "Der Titel muss 1 bis 80 Zeichen enthalten.";
    if (!body.trim() || body.trim().length > 240) return "Die Nachricht muss 1 bis 240 Zeichen enthalten.";
    if (target === "class" && !classId) return "Bitte eine Klasse auswählen.";
    if (timing === "later" && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) return "Bitte einen zukünftigen Zeitpunkt wählen.";
    if (actionType === "internal" && !/^\/[A-Za-z0-9_/?=&.-]*$/.test(actionValue)) return "Der interne Pfad muss mit / beginnen.";
    if (actionType === "web" && !/^https:\/\/\S+$/i.test(actionValue)) return "Bitte eine gültige HTTPS-Adresse eingeben.";
    return null;
  };

  const requestSend = () => {
    const error = validate();
    if (error) { toast.error(error); return; }
    setConfirmOpen(true);
  };

  const send = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)("admin_create_push_message", {
      p_title: title.trim(), p_body: body.trim(), p_target: target,
      p_target_class_id: target === "class" ? classId : null,
      p_action_type: actionType, p_action_value: actionType === "none" || actionType === "store" ? null : actionValue.trim(),
      p_scheduled_at: timing === "later" ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
    });
    setSaving(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success(timing === "now" ? "Push-Nachricht wurde zum Versand eingereiht" : "Push-Nachricht wurde geplant");
    setBody(""); setActionType("none"); setActionValue(""); setTiming("now"); setScheduledAt("");
    await load();
  };

  const cancel = async (id: string) => {
    const { data, error } = await (supabase.rpc as any)("admin_cancel_push_message", { p_message_id: id });
    if (error || !data) toast.error(error?.message || "Nachricht konnte nicht abgebrochen werden");
    else toast.success("Geplanter Versand wurde abgebrochen");
    await load();
  };

  const targetDescription = target === "class" ? `${selectedClass?.school_name ?? ""} · ${selectedClass?.class_name ?? ""}` : targetLabels[target];

  return (
    <Card className="border-2 border-primary/25 p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h2 className="flex items-center gap-2 text-2xl font-bold"><BellRing className="h-6 w-6 text-primary" />Push-Nachrichten</h2><p className="text-sm text-muted-foreground">Frei formulieren, gezielt versenden und den Provider-Status nachvollziehen.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div className="space-y-4">
          <div><Label htmlFor="push-title">Titel ({title.length}/80)</Label><Input id="push-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label htmlFor="push-body">Nachricht ({body.length}/240)</Label><Textarea id="push-body" rows={4} maxLength={240} placeholder="Deine Nachricht …" value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Empfänger</Label><Select value={target} onValueChange={(v) => setTarget(v as PushTarget)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Geräte</SelectItem><SelectItem value="student">Nur Schüler</SelectItem><SelectItem value="teacher">Nur Lehrkräfte</SelectItem><SelectItem value="class">Bestimmte Klasse</SelectItem></SelectContent></Select></div>
            {target === "class" && <div><Label>Klasse</Label><Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="Klasse wählen" /></SelectTrigger><SelectContent>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.school_name} · {item.class_name} ({item.subscriber_count})</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Weiterleitung</Label><Select value={actionType} onValueChange={(v) => { setActionType(v as ActionType); setActionValue(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem><SelectItem value="store">App Store / Play Store</SelectItem><SelectItem value="internal">Interne App-Seite</SelectItem><SelectItem value="web">HTTPS-Webseite</SelectItem></SelectContent></Select></div>
            {(actionType === "internal" || actionType === "web") && <div><Label>{actionType === "internal" ? "App-Pfad" : "Webadresse"}</Label><Input placeholder={actionType === "internal" ? "/quests" : "https://…"} value={actionValue} onChange={(e) => setActionValue(e.target.value)} /></div>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Versand</Label><Select value={timing} onValueChange={(v) => setTiming(v as "now" | "later")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Sofort</SelectItem><SelectItem value="later">Planen</SelectItem></SelectContent></Select></div>
            {timing === "later" && <div><Label>Datum und Uhrzeit</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>}
          </div>
          <Button className="w-full" onClick={requestSend} disabled={saving}><Send className="mr-2 h-4 w-4" />{timing === "now" ? "Jetzt versenden" : "Versand planen"}</Button>
        </div>

        <div className="rounded-[28px] bg-zinc-950 p-5 text-white shadow-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Vorschau</p>
          <div className="rounded-3xl bg-zinc-800/95 p-4"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl">⚡</div><div className="min-w-0"><div className="flex items-center justify-between gap-3"><p className="font-bold">{title || "BOOST"}</p><span className="text-xs text-zinc-400">jetzt</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{body || "Deine Nachricht erscheint hier."}</p>{actionType !== "none" && <p className="mt-2 flex items-center gap-1 text-xs text-emerald-300"><ExternalLink className="h-3 w-3" />Beim Tippen wird ein Ziel geöffnet</p>}</div></div></div>
          <p className="mt-4 text-xs text-zinc-400">Zielgruppe: {targetDescription}</p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Nachricht</TableHead><TableHead>Ziel</TableHead><TableHead>Zeitpunkt</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Akzeptiert / Fehler</TableHead><TableHead /></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow> : messages.map((message) => <TableRow key={message.id}><TableCell><p className="font-medium">{message.title}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{message.body}</p></TableCell><TableCell>{targetLabels[message.target]}</TableCell><TableCell>{new Date(message.scheduled_at).toLocaleString("de-AT")}</TableCell><TableCell><span className={message.status === "failed" ? "text-destructive" : message.status === "sent" ? "text-primary" : "text-muted-foreground"}>{statusLabels[message.status] ?? message.status}</span>{message.error && <p className="max-w-xs truncate text-xs text-destructive" title={message.error}>{message.error}</p>}</TableCell><TableCell className="text-right">{message.success_count || message.sent_count || 0} / {message.failure_count}</TableCell><TableCell className="text-right">{message.status === "pending" && <Button size="sm" variant="ghost" onClick={() => void cancel(message.id)}><XCircle className="h-4 w-4" /></Button>}</TableCell></TableRow>)}{!loading && messages.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Noch keine Push-Nachrichten.</TableCell></TableRow>}</TableBody></Table></div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Push-Nachricht bestätigen</AlertDialogTitle><AlertDialogDescription>„{title}“ wird an {targetDescription} {timing === "now" ? "sofort" : `am ${new Date(scheduledAt).toLocaleString("de-AT")}`} gesendet. Dieser Vorgang kann nach Beginn nicht zurückgenommen werden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => void send()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Bestätigen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </Card>
  );
}
