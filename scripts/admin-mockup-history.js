// Shared administration fixtures for standalone prototypes; the live app reads persisted versions.
function adminMoment(clock = "") {
  const mode = S.adminTime || "now";
  const label = mode === "now" ? "Now" : mode === "diff" ? "A 10 Nov → B 11 Nov · diff" : "10 Nov, 12:00";
  return `<span class="admin-moment"><button class="mx-button" aria-label="Pick an administration moment" onclick="go({adminScale:!S.adminScale})">${clock}${label}</button>${S.adminScale ? `<span class="admin-time-menu" role="dialog" aria-label="Pick a moment"><div class="sec">Administration history</div><div class="tabs"><button onclick="go({adminTime:'now',adminScale:false,usr:null,ivd:null,dlg:null})">Now</button><button onclick="go({adminTime:'past',adminScale:false,usr:null,ivd:null,dlg:null})">10 Nov, 12:00</button><button onclick="go({adminTime:'diff',adminScale:false,usr:null,ivd:null,dlg:null})">Compare A / B</button></div></span>` : ""}</span>`;
}
function adminHistoryView(section, live) {
  const mode = S.adminTime || "now";
  if (mode === "now") return live;
  if (section === "users") return `<div class="admin-history-notice"><span>${mode === "diff" ? "Comparing A and B" : "Viewing history"} · read only</span><button class="mx-button" onclick="go({adminTime:'now'})">Return to Now</button></div>${live}`;
  const entries = {
    organization: [["Organization", "Who may invite", "Any active user", "Administrators only"]],
    users: [["Anna Kovaleva", "Role", "Administrator", "Administrator"], ["Oleg Sokolov", "State", "Active", "Blocked"]],
    invitations: [["kirill@example.com", "State", "Sent", "Withdrawn"]],
    plugins: [["Notes", "State", "Enabled", "Disabled"]],
  }[section];
  return `<div class="page"><div class="inner"><div class="admin-history-notice"><span>${mode === "diff" ? "Comparing A and B" : "Viewing history"} · read only</span><button class="mx-button" onclick="go({adminTime:'now'})">Return to Now</button></div><div class="admin-cards">${entries.map(([name,field,a,b]) => `<article class="admin-object" data-room-anchor="${section}:${name}" data-change="${mode === "diff" && a !== b ? "changed" : "unchanged"}"><h3>${name}</h3><dl><div><dt>${field}</dt><dd>${mode === "diff" && a !== b ? `<del>${a}</del> → ${b}` : a}</dd></div></dl><p class="admin-meta">Anna Kovaleva · ${mode === "diff" ? "11" : "10"} Nov 2026, 12:00</p></article>`).join("")}</div></div></div>`;
}
