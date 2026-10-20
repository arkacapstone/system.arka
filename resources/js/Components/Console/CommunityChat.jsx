import { ChatIcon, CloseIcon, MinimizeIcon, SendIcon, TrashIcon } from '@/Components/Icons';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const STATE_KEY = 'arka.chat';

// While the box is open, new messages show up within a few seconds; otherwise only the
// unread count on the icon is refreshed, less often.
const OPEN_POLL_MS = 4_000;
const CLOSED_POLL_MS = 30_000;

/** 'closed' | 'open' | 'minimized'. Kept across pages: every page mounts the layout again. */
function readState() {
    try {
        return window.localStorage.getItem(STATE_KEY) ?? 'closed';
    } catch {
        return 'closed';
    }
}

function initialsOf(name) {
    return name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function dayLabel(iso) {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MessageRow({ message, showSender, onDelete }) {
    return (
        <li className={`group flex gap-2 ${message.mine ? 'flex-row-reverse' : ''} ${showSender ? 'mt-3' : 'mt-1'}`}>
            {/* Avatar only on the first message of a run from the same person. */}
            <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center border border-arka-teal/30 bg-console-avatar font-condensed text-[11px] font-bold text-console-heading ${
                    showSender && !message.mine ? '' : 'invisible'
                } ${message.mine ? 'hidden' : ''}`}
            >
                {initialsOf(message.sender.name)}
            </span>

            <div className={`flex max-w-[80%] flex-col ${message.mine ? 'items-end' : 'items-start'}`}>
                {showSender && !message.mine && (
                    <p className="mb-0.5 text-[11px] text-console-muted">
                        <span className="font-semibold text-console-heading">{message.sender.name}</span> · {message.sender.role}
                    </p>
                )}
                <div className={`flex items-end gap-1.5 ${message.mine ? 'flex-row-reverse' : ''}`}>
                    <p
                        title={timeLabel(message.at)}
                        className={`whitespace-pre-wrap break-words px-3 py-1.5 text-sm ${
                            message.mine ? 'bg-arka-teal text-white' : 'border border-console-line bg-console-raised text-console-text'
                        }`}
                    >
                        {message.body}
                    </p>
                    <span className="shrink-0 pb-0.5 font-mono text-[9px] text-console-dim">{timeLabel(message.at)}</span>
                    {message.canDelete && (
                        <button
                            type="button"
                            onClick={() => onDelete(message)}
                            className="shrink-0 pb-0.5 text-console-dim opacity-0 transition-opacity hover:text-console-error focus:opacity-100 group-hover:opacity-100"
                            aria-label="Delete message"
                            title="Delete message"
                        >
                            <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}

/**
 * Community Chat, Messenger style: the chat icon in the top bar (with the unread count) opens a
 * box in the bottom-right corner. The box can be minimized to its title bar or closed, and it
 * stays as it was when moving to another page.
 */
export default function CommunityChat() {
    const [state, setStateValue] = useState(readState);
    const [chat, setChat] = useState(null); // { messages, memberCount }
    const [unread, setUnread] = useState(0);
    const [body, setBody] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);
    const listRef = useRef(null);
    const nearBottom = useRef(true);
    const inputRef = useRef(null);

    const setState = (value) => {
        setStateValue(value);
        try {
            window.localStorage.setItem(STATE_KEY, value);
        } catch {
            // Private window: the box just won't remember its state between pages.
        }
    };

    const open = state === 'open';

    // Open box: the messages (and they are marked read). Otherwise: just the unread count.
    const refresh = useCallback(() => {
        if (document.visibilityState !== 'visible') return;

        window.axios
            .get(route('community.feed'), { params: open ? { messages: 1 } : {} })
            .then(({ data }) => {
                if (data.messages) setChat({ messages: data.messages, memberCount: data.memberCount });
                setUnread(data.unreadCount);
            })
            .catch(() => {
                // Offline or signed out: keep what we have; the next poll tries again.
            });
    }, [open]);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, open ? OPEN_POLL_MS : CLOSED_POLL_MS);
        document.addEventListener('visibilitychange', refresh);

        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [open, refresh]);

    // Stay at the newest message, unless the user scrolled up to read older ones.
    useEffect(() => {
        const list = listRef.current;
        if (list && nearBottom.current) list.scrollTop = list.scrollHeight;
    }, [chat?.messages, open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const onScroll = () => {
        const list = listRef.current;
        nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    };

    const send = (e) => {
        e?.preventDefault();
        if (body.trim() === '' || sending) return;

        setSending(true);
        setError(null);
        nearBottom.current = true;

        window.axios
            .post(route('community.messages.store'), { body })
            .then(({ data }) => {
                setChat({ messages: data.messages, memberCount: data.memberCount });
                setBody('');
            })
            .catch((failure) => setError(failure.response?.data?.errors?.body?.[0] ?? 'The message could not be sent. Try again.'))
            .finally(() => setSending(false));
    };

    const remove = (message) => {
        if (!window.confirm('Delete this message?')) return;

        window.axios
            .delete(route('community.messages.destroy', message.id))
            .then(({ data }) => setChat({ messages: data.messages, memberCount: data.memberCount }))
            .catch(() => setError('The message could not be deleted.'));
    };

    // Enter sends; Shift+Enter adds a new line.
    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) send(e);
    };

    const messages = chat?.messages ?? [];

    return (
        <>
            {/* The chat icon in the top bar, beside the notification bell. */}
            <button
                type="button"
                onClick={() => setState(open ? 'closed' : 'open')}
                className={`relative flex h-10 w-10 items-center justify-center border text-console-heading transition-colors hover:border-arka-teal hover:text-arka-teal ${
                    state !== 'closed' ? 'border-arka-teal text-arka-teal' : 'border-console-line'
                }`}
                aria-label={`Community chat (${unread} unread)`}
                aria-expanded={open}
                title="Community chat"
            >
                <ChatIcon className="h-5 w-5" />
                {unread > 0 && !open && (
                    <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center bg-arka-gold px-1 font-mono text-[10px] font-bold leading-none text-arka-navy">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Drawn in <body>, not inside the top bar: the bar's backdrop-blur would make
                "fixed" stick to the bar instead of the bottom of the screen. */}
            {state !== 'closed' &&
                createPortal(
                <section
                    aria-label="Community chat"
                    className={`fixed bottom-0 right-4 z-40 flex w-[calc(100vw-2rem)] flex-col border border-b-0 border-console-line bg-console-panel shadow-2xl shadow-black/30 print:hidden sm:right-6 sm:w-[360px] ${
                        open ? 'h-[min(520px,calc(100vh-6rem))]' : ''
                    }`}
                >
                    {/* Title bar: click it to minimize or restore. */}
                    <div className="flex items-center gap-2 border-b border-console-line bg-console-raised px-3 py-2">
                        <button type="button" onClick={() => setState(open ? 'minimized' : 'open')} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <ChatIcon className="h-4 w-4 shrink-0 text-arka-teal" />
                            <span className="min-w-0">
                                <span className="block truncate font-condensed text-base font-bold leading-tight text-console-heading">Community Chat</span>
                                <span className="block truncate text-[11px] leading-tight text-console-muted">
                                    {open && chat ? `Everyone in your home office · ${chat.memberCount} members` : unread > 0 ? `${unread} new` : 'Everyone in your home office'}
                                </span>
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setState(open ? 'minimized' : 'open')}
                            className="p-1 text-console-muted transition-colors hover:text-arka-teal"
                            aria-label={open ? 'Minimize chat' : 'Open chat'}
                            title={open ? 'Minimize' : 'Open'}
                        >
                            <MinimizeIcon className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setState('closed')}
                            className="p-1 text-console-muted transition-colors hover:text-arka-teal"
                            aria-label="Close chat"
                            title="Close"
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>

                    {open && (
                        <>
                            <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-2">
                                {chat === null ? (
                                    <p className="mt-8 text-center text-sm text-console-muted">Loading…</p>
                                ) : messages.length === 0 ? (
                                    <p className="mt-8 text-center text-sm italic text-console-muted">No messages yet. Say hello to your team!</p>
                                ) : (
                                    <ul>
                                        {messages.map((message, index) => {
                                            const previous = messages[index - 1];
                                            const newDay = !previous || dayLabel(previous.at) !== dayLabel(message.at);
                                            const showSender = newDay || previous.sender.id !== message.sender.id;

                                            return (
                                                <Fragment key={message.id}>
                                                    {newDay && (
                                                        <li className="my-3 list-none text-center font-mono text-[10px] uppercase tracking-[0.18em] text-console-dim">
                                                            {dayLabel(message.at)}
                                                        </li>
                                                    )}
                                                    <MessageRow message={message} showSender={showSender} onDelete={remove} />
                                                </Fragment>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <form onSubmit={send} className="border-t border-console-line p-2">
                                <div className="flex items-end gap-2">
                                    <label htmlFor="community-message" className="sr-only">
                                        Message
                                    </label>
                                    <textarea
                                        id="community-message"
                                        ref={inputRef}
                                        rows={1}
                                        value={body}
                                        maxLength={2000}
                                        onChange={(e) => setBody(e.target.value)}
                                        onKeyDown={onKeyDown}
                                        placeholder="Aa"
                                        className="block max-h-28 w-full resize-none border-console-line bg-console-panel py-2 text-sm text-console-text placeholder:text-console-dim focus:border-arka-teal focus:ring-arka-teal"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || body.trim() === ''}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center bg-arka-teal text-white transition-colors hover:bg-arka-teal/90 disabled:opacity-40"
                                        aria-label="Send"
                                        title="Send (Enter)"
                                    >
                                        <SendIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                {error && <p className="mt-1 text-xs text-console-error">{error}</p>}
                            </form>
                        </>
                    )}
                </section>,
                document.body,
            )}
        </>
    );
}
