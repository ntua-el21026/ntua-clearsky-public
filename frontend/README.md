# clearSKY frontend

The React 19 + TypeScript/Vite application provides authentication, dashboards,
institution account management, instructor XLSX grade submission, student grade
views, statistics charts, and review-request screens. Routes live in
[src/routes/AppRoutes.tsx](src/routes/AppRoutes.tsx); pages are under
[src/pages/](src/pages/).

## Development

The [root Compose setup](../README.md#local-setup) runs the whole stack, including
the Vite development container, at `http://localhost:5173`. For host-side frontend
development with the backend already running:

```bash
cd frontend
npm ci --ignore-scripts
VITE_API_BASE_URL=http://localhost:8080 npm run dev -- --host 127.0.0.1
```

`VITE_API_BASE_URL` is read by Axios callers through `import.meta.env`; it is a
browser-visible API base URL, not a secret. Use `localhost:5173`, matching the
gateway's configured CORS origin. A browser session keeps its JWT/user summary
in localStorage; the backend enforces authorization.

## Commands and flows

- `npm run build`: TypeScript project checks, then a Vite build to the generated local `dist/` directory.
- `npm run lint`: existing ESLint configuration.
- `npm run preview`: preview a previously built frontend.

There is no frontend `test` script. Root [offline tests](../tests/README.md) cover
backend boundaries; they do not render the browser.

`PostGrades.tsx` first calls `/grades/validateExcel`, displays parsed course,
exam period and count, then sends the file to `/grades/upload/initial` or
`/grades/upload/final` on confirmation. `Statistics.tsx` obtains available
courses and grade/per-question distributions for the selected exam period.
`ViewGrades.tsx` contains student grades/review actions; `ReviewRequests.tsx`
provides instructor replies. UI visibility alone is not a role authorization
contract. Existing submission behavior is unchanged and not newly qualified.

The logo is committed under `src/assets/`. No personal Drive link is needed to
inspect the source. Instructor reply attachments are user-supplied external URLs,
not bundled application assets; their access and privacy are separate concerns.
