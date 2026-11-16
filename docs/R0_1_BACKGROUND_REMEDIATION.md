# R0.1 — Background reliability remediation

Baseline: 10475467188d93a295d55f95dac3a7354cff78c8.

Changes: synchronous registration of runtime.onMessage with a deferred service handler; cache miss now reads storage, shares in-flight reads and releases lock on rejection; external gateway awaits all 22 operations and returns redacted errors. Successful legacy response bodies unchanged. Unknown operation previously returned null; now returns explicit failure. Added regression tests for these paths.

Scope: runtime onMessage cold start only; other event registrations remain deferred and require separate review. No claim of full background lifecycle correctness. Storage write/merge consistency and removal races remain R0-07. No broad RPC or new public business contracts. Sidepanel/extension optional service initialization remains pending. No tests/build executed in connector environment; run pnpm background:test and pnpm compile locally. Verify actual worker wake-up in integrated extension during R0.3. R0.2 and R0.3 pending.
