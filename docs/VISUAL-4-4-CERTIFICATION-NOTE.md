# Visual 4.4 certification note

Visual 4.4 intentionally reuses the existing classified Alpha Visual Feature Freeze source contract rather than adding a duplicate test target to the repository taxonomy. The freeze contract now verifies the recertified `layout.tsx` blob, preserves the other six frozen structural blobs, requires Visual 4.0 to remain mounted, requires Visual 4.4 to be mounted after it, and keeps the Visual 3.3–3.9 prohibition.

Runtime confidence remains browser-driven: full CI/E2E plus the Visual 4.2 notebook-density and Visual 4.3 portrait/landscape certs must pass on the exact PR head before promotion.
