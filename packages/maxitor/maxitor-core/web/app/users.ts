// packages/maxitor/maxitor-core/web/app/users.ts
// The server actions of invitations and of Settings → Users (specs/086-sign-in-and-invitation/contracts/actions.md):
// each calls one action of the core's backend with the person's session; the page's scripts never see a token.
"use server";

import { core, type Invitation, type Person, type Refusal } from "@/lib/core";

/** What a form gets back when the backend refuses. */
export type Refused = { refused: Refusal };

export async function sendInvitation(code: string, email: string, isAdmin: boolean): Promise<{ invitation: Invitation } | Refused> {
  const answer = await core<{ invitation: Invitation }>("POST", "/api/v1/organizations/invitations", { code, email, is_admin: isAdmin });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

export async function resendInvitation(code: string, invitationId: string): Promise<{ invitation: Invitation } | Refused> {
  const answer = await core<{ invitation: Invitation }>("POST", "/api/v1/organizations/invitations/resend", { code, invitation_id: invitationId });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

export async function withdrawInvitation(code: string, invitationId: string): Promise<{ invitation: Invitation } | Refused> {
  const answer = await core<{ invitation: Invitation }>("POST", "/api/v1/organizations/invitations/withdraw", { code, invitation_id: invitationId });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

/** The invitations the signed-in user sent in the organization, newest first. */
export async function listMyInvitations(code: string): Promise<Invitation[]> {
  const answer = await core<{ invitations: Invitation[] }>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/invitations/mine`);
  return answer.ok ? answer.data.invitations : [];
}

/** The organization's settings as its administrator sees them. */
export type Settings = {
  code: string;
  name: string;
  who_may_invite: "any_user" | "administrators";
  invitation_days: number;
  pending_by_users: Invitation[];
};

export async function setWhoMayInvite(code: string, value: "any_user" | "administrators"): Promise<{ who_may_invite: string; withdrawn: Invitation[] } | Refused> {
  const answer = await core<{ who_may_invite: string; withdrawn: Invitation[] }>("POST", "/api/v1/organizations/settings/who-may-invite", { code, who_may_invite: value });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

/** A user of the organization as Settings → Users shows them. */
export type User = {
  id: string;
  account_id: string;
  name: string;
  email: string;
  is_admin: boolean;
  state: "active" | "blocked" | "removed";
  appeared: "registered" | "invited";
  invited_by: Person | null;
  created_at: string;
  changed_at: string;
  changed_by: Person | null;
  last_sign_in_at: string | null;
};

export async function listUsers(code: string): Promise<{ users: User[]; invitations: Invitation[] } | Refused> {
  const answer = await core<{ users: User[]; invitations: Invitation[] }>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/users`);
  return answer.ok ? answer.data : { refused: answer.refusal };
}

async function changeUser(verb: string, code: string, userId: string, more: Record<string, unknown> = {}): Promise<{ user: User } | Refused> {
  const answer = await core<{ user: User }>("POST", `/api/v1/organizations/users/${verb}`, { code, user_id: userId, ...more });
  return answer.ok ? answer.data : { refused: answer.refusal };
}

export async function blockUser(code: string, userId: string): Promise<{ user: User } | Refused> {
  return changeUser("block", code, userId);
}

export async function unblockUser(code: string, userId: string): Promise<{ user: User } | Refused> {
  return changeUser("unblock", code, userId);
}

export async function removeUser(code: string, userId: string): Promise<{ user: User } | Refused> {
  return changeUser("remove", code, userId);
}

export async function setAdministrator(code: string, userId: string, isAdmin: boolean): Promise<{ user: User } | Refused> {
  return changeUser("administrator", code, userId, { is_admin: isAdmin });
}
