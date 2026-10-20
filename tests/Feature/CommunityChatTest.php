<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\HomeOffice;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Community Chat: one room per home office, for every role, in the chat box opened from the
 * top bar. The box talks to the server in JSON.
 */
class CommunityChatTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    private User $admin;

    private User $contractor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->superAdmin()->create();
        $this->admin = User::factory()->admin()->create();
        $this->contractor = User::factory()->create();
    }

    public function test_every_role_can_post_and_read_the_chat(): void
    {
        foreach ([$this->superAdmin, $this->admin, $this->contractor] as $user) {
            $this->actingAs($user)
                ->postJson(route('community.messages.store'), ['body' => "Hello from {$user->name}"])
                ->assertCreated();
        }

        $this->actingAs($this->contractor)
            ->getJson(route('community.feed', ['messages' => 1]))
            ->assertOk()
            ->assertJsonCount(3, 'messages')
            ->assertJsonPath('messages.0.sender.name', $this->superAdmin->name)
            ->assertJsonPath('messages.0.mine', false)
            ->assertJsonPath('messages.2.mine', true)
            ->assertJsonPath('memberCount', 3);

        // One community room for the whole home office.
        $this->assertSame(1, Conversation::query()->withoutGlobalScopes()->count());
        $this->assertDatabaseCount('conversation_participants', 3);
    }

    public function test_the_chat_icon_counts_unread_messages_until_the_box_is_opened(): void
    {
        $this->actingAs($this->admin)->postJson(route('community.messages.store'), ['body' => 'One']);
        $this->actingAs($this->admin)->postJson(route('community.messages.store'), ['body' => 'Two']);

        $this->actingAs($this->contractor)
            ->getJson(route('community.feed'))
            ->assertExactJson(['unreadCount' => 2]);

        // The sender's own messages are never unread for them.
        $this->actingAs($this->admin)
            ->getJson(route('community.feed'))
            ->assertExactJson(['unreadCount' => 0]);

        // Opening the box marks everything read.
        $this->actingAs($this->contractor)->getJson(route('community.feed', ['messages' => 1]));
        $this->travel(1)->seconds();

        $this->actingAs($this->contractor)
            ->getJson(route('community.feed'))
            ->assertExactJson(['unreadCount' => 0]);
    }

    public function test_an_empty_message_is_refused(): void
    {
        $this->actingAs($this->contractor)
            ->postJson(route('community.messages.store'), ['body' => '   '])
            ->assertJsonValidationErrors('body');

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_people_delete_their_own_messages_and_the_super_admin_any(): void
    {
        $this->actingAs($this->admin)->postJson(route('community.messages.store'), ['body' => 'From the admin']);
        $message = Message::query()->withoutGlobalScopes()->sole();

        $this->actingAs($this->contractor)
            ->deleteJson(route('community.messages.destroy', $message))
            ->assertForbidden();

        $this->actingAs($this->superAdmin)
            ->deleteJson(route('community.messages.destroy', $message))
            ->assertOk()
            ->assertJsonCount(0, 'messages');

        $this->actingAs($this->contractor)->postJson(route('community.messages.store'), ['body' => 'Mine']);
        $own = Message::query()->withoutGlobalScopes()->sole();

        $this->actingAs($this->contractor)
            ->deleteJson(route('community.messages.destroy', $own))
            ->assertOk();

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_each_home_office_has_its_own_chat(): void
    {
        $this->actingAs($this->contractor)->postJson(route('community.messages.store'), ['body' => 'Makarius only']);
        $message = Message::query()->withoutGlobalScopes()->sole();

        $other = HomeOffice::query()->create(['name' => 'Harbor Staffing']);
        $outsider = User::factory()->superAdmin()->create(['home_office_id' => $other->id]);

        $this->actingAs($outsider)
            ->getJson(route('community.feed', ['messages' => 1]))
            ->assertJsonCount(0, 'messages')
            ->assertJsonPath('memberCount', 1);

        $this->actingAs($outsider)
            ->getJson(route('community.feed'))
            ->assertExactJson(['unreadCount' => 0]);

        // Even by its link, another home office's message is not found.
        $this->actingAs($outsider)
            ->deleteJson(route('community.messages.destroy', $message))
            ->assertNotFound();

        $this->assertSame(2, Conversation::query()->withoutGlobalScopes()->count());
    }

    public function test_the_chat_is_not_a_sidebar_module(): void
    {
        $this->actingAs($this->contractor)
            ->get(route('profile.edit'))
            ->assertInertia(fn ($page) => $page->where('navigation', fn ($items) => ! collect($items)->contains('key', 'community')));
    }
}
