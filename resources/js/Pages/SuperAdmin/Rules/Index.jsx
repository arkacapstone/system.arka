import Field, { ConsoleButton, PasswordField, SecondaryButton } from '@/Components/Console/Field';
import Panel, { PanelHeading } from '@/Components/Console/Panel';
import RuleGroupForm from '@/Components/Console/RuleGroupForm';
import { Tag } from '@/Components/Console/StatusBadge';
import SuperAdminLayout from '@/Layouts/SuperAdminLayout';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';

/**
 * The Gmail account ARKA sends invite links and password resets from.
 * The saved App Password is never shown; leave it blank to keep it.
 */
function MailSenderPanel({ mail }) {
    const [testing, setTesting] = useState(false);
    const { data, setData, put, processing, errors, isDirty } = useForm({
        username: mail.username,
        password: '',
        from_name: mail.fromName,
    });

    const submit = (e) => {
        e.preventDefault();
        put(route('super-admin.rules.mail.update'), { preserveScroll: true, onSuccess: () => setData('password', '') });
    };

    const sendTest = () =>
        router.post(route('super-admin.rules.mail.test'), {}, { preserveScroll: true, onStart: () => setTesting(true), onFinish: () => setTesting(false) });

    return (
        <div id="email-sender" className="scroll-mt-24">
        <Panel>
            <PanelHeading
                title="Email sender"
                subtitle="Your home office's Gmail. ARKA sends invites, password resets and notifications to your contractors from it."
                action={<Tag tone={mail.configured ? 'live' : 'waiting'}>{mail.configured ? 'Set up' : 'Not set up'}</Tag>}
            />
            <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-3">
                <Field
                    id="mail_username"
                    type="email"
                    label="Username (Gmail)"
                    value={data.username}
                    onChange={(e) => setData('username', e.target.value)}
                    error={errors.username}
                    placeholder="name@gmail.com"
                    autoComplete="off"
                    required
                />
                <div>
                    <PasswordField
                        id="mail_password"
                        label="Password (App Password)"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                        placeholder={mail.hasPassword ? 'Saved. Leave blank to keep it' : 'xxxx xxxx xxxx xxxx'}
                        autoComplete="new-password"
                        required={!mail.hasPassword}
                    />
                    <p className="mt-1.5 text-xs text-console-muted">
                        Not the normal Gmail password. Create one at{' '}
                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="font-medium text-arka-teal underline hover:no-underline">
                            myaccount.google.com/apppasswords
                        </a>{' '}
                        (
                        <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noopener noreferrer" className="text-arka-teal underline hover:no-underline">
                            2-Step Verification
                        </a>{' '}
                        must be on).
                    </p>
                </div>
                <Field
                    id="mail_from_name"
                    label="Sender name"
                    value={data.from_name}
                    onChange={(e) => setData('from_name', e.target.value)}
                    error={errors.from_name}
                    required
                />
                <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
                    <ConsoleButton type="submit" disabled={processing || (!isDirty && mail.configured)}>
                        Save email sender
                    </ConsoleButton>
                    <SecondaryButton onClick={sendTest} disabled={testing || !mail.configured || isDirty}>
                        {testing ? 'Sending…' : 'Send test email'}
                    </SecondaryButton>
                    <p className="text-xs text-console-muted">The test email goes to the sender's own inbox.</p>
                </div>
            </form>
        </Panel>
        </div>
    );
}

export default function Index({ groups, mail }) {
    return (
        <SuperAdminLayout title="System & Rules">
            <div className="mx-auto flex max-w-[1560px] flex-col gap-8">
                <p className="text-console-muted">
                    System &amp; Rules defines the rules; Payroll applies them. Changes affect payroll computed from now on — released payslips never change.
                    Tithes and devotional penalties are not payroll deductions, so they are not configured here.
                </p>

                {groups.map((group) => (
                    <RuleGroupForm key={group.key} title={group.title} subtitle={group.subtitle} rules={group.rules} />
                ))}

                <MailSenderPanel mail={mail} />
            </div>
        </SuperAdminLayout>
    );
}
