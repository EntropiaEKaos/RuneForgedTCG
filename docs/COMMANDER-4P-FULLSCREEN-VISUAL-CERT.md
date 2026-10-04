# Commander 4P Fullscreen Table — Visual Certification

This branch exists only to trigger the visual push workflows for the stacked Commander fullscreen-table work.

Acceptance criteria:
- active/completed match owns the viewport;
- lobby/header/seat cards do not sit above the battlefield;
- viewer is bottom, opponents are left/top/right relative to viewer;
- central space remains readable for stack, targeting, attack routes and Phaser FX;
- React/server remain authoritative; Phaser remains presentation-only;
- hard refresh restores the fullscreen table at the authoritative revision;
- browser artifact must include the real fullscreen-table screenshot before visual approval.

Source implementation HEAD before this certification-only commit: `ed66574fc9a25f656782b38e11fc04378efb7b78`.
