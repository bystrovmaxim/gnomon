// packages/maxitor/maxitor-core/web/app/users.ts
// The server actions of invitations and of Settings → Users (specs/086-sign-in-and-invitation/contracts/actions.md):
// each calls one action of the core's backend with the person's session; the page's scripts never see a token.
"use server";

import { core, type Invitation, type Refusal } from "@/lib/core";

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
