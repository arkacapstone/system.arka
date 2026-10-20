<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Community chat: one chat room per home office for everyone in it (Super Admin, Admins,
 * Contractors). It lives in a Messenger-style box opened from the chat icon in the top bar,
 * on every page. The box asks this controller for new messages every few seconds (polling),
 * so no websocket server is needed. Every answer is JSON.
 */
class CommunityChatController extends Controller
{
    /**
     * How many of the latest messages the box shows.
     */
    private const SHOWN = 100;

    /**
     * The unread count for the chat icon. With `messages=1` (the box is open) it also returns
     * the latest messages and marks them as read.
     */
    public function feed(Request $request): JsonResponse
    {
        $user = $request->user();
        $community = Conversation::communityFor($user);

        if (! $request->boolean('messages')) {
            return response()->json(['unreadCount' => $this->unreadCount($community, $user)]);
        }

        $community->join($user);
        $community->markReadBy($user);

        return response()->json($this->conversation($community, $user));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ], [], ['body' => 'message']);

        $user = $request->user();
        $community = Conversation::communityFor($user);
        $community->join($user);

        $community->messages()->create(['user_id' => $user->id, 'body' => trim($validated['body'])]);
        $community->markReadBy($user);

        return response()->json($this->conversation($community, $user), 201);
    }

    /**
     * Removes a message: the sender's own, or any message for the Super Admin (moderation).
     * A message of another home office is not found (global scope).
     */
    public function destroy(Request $request, Message $message): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canDelete($user, $message), 403);

        $message->delete();

        return response()->json($this->conversation($message->conversation, $user));
    }

    /**
     * @return array<string, mixed>
     */
    private function conversation(Conversation $community, User $user): array
    {
        $messages = $community->messages()
            ->with('sender:id,name,role')
            ->latest('id')
            ->limit(self::SHOWN)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (Message $message) => [
                'id' => $message->id,
                'body' => $message->body,
                'at' => $message->created_at->toIso8601String(),
                'mine' => $message->user_id === $user->id,
                'canDelete' => $this->canDelete($user, $message),
                'sender' => [
                    'id' => $message->sender->id,
                    'name' => $message->sender->name,
                    'role' => $message->sender->role->label(),
                ],
            ]);

        return [
            'messages' => $messages,
            'memberCount' => User::query()->active()->count(),
            'unreadCount' => 0,
        ];
    }

    /**
     * Messages from others since the user last read the chat (all of them if never opened).
     */
    private function unreadCount(Conversation $community, User $user): int
    {
        $lastRead = DB::table('conversation_participants')
            ->where('conversation_id', $community->id)
            ->where('user_id', $user->id)
            ->value('last_read_at');

        return $community->messages()
            ->where('user_id', '!=', $user->id)
            ->when($lastRead, fn ($query) => $query->where('created_at', '>', $lastRead))
            ->count();
    }

    private function canDelete(User $user, Message $message): bool
    {
        return $message->user_id === $user->id || $user->isSuperAdmin();
    }
}
