# Skole — frontend

React single-page app of Skole, the school management system. It talks to the REST API in `../backend`
(the source of truth for every request and response shape) and signs users in with Firebase
Authentication. Architecture overview: `../docs/ARCHITECTURE.md`.

## Stack

| Concern      | Choice                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Build        | Vite 8, `@vitejs/plugin-react`, JavaScript + JSX only                                                            |
| UI           | React 19, Tailwind CSS v4 (`@tailwindcss/vite`, tokens in `src/index.css`), lucide-react icons |
| Routing      | `react-router` 8 in data mode (`RouterProvider` comes from `react-router/dom`; never install `react-router-dom`) |
| Server state | TanStack Query v5                                                                                                |
| Forms        | react-hook-form + zod 4 (`@hookform/resolvers`)                                                                  |
| Auth         | Firebase v12 modular SDK, email and password                                                                     |

## Scripts

```bash
npm install
cp .env.example .env     # then fill in the Firebase web app values
npm run dev              # http://localhost:5173 (strict port; /api is proxied to 127.0.0.1:API_PORT, default 3000)
npm run lint             # ESLint (react-hooks rules included)
npm run build            # production build into dist/
npm run format           # Prettier (with the Tailwind class sorter)
npm run check            # lint + build
```

## Environment

`src/config/env.js` validates the variables at start-up. A missing Firebase value shows a plain
full-page message instead of a blank screen.

| Variable                                                                                                 | Required | Default                                                            |
| -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | yes      | none                                                               |
| `VITE_API_BASE_URL`                                                                                      | no       | `/api/v1` (goes through the Vite proxy, so no CORS in development) |

The Firebase project must be the same one the backend's service account belongs to. In development a
red banner appears when `GET /health` reports a different project id.

`src/constants/shared.js` is a byte-identical copy of `../backend/src/constants/shared.js` and must not be
edited here; `npm run check:constants` in the backend verifies it. Labels, tones and option lists for its
enums live in `src/constants/ui.js`.

## Folder rule

> If a file mentions a school resource (student, class, grade, ...) it lives in `src/features/<resource>/`.
> If it knows nothing about any resource it lives in `components`, `hooks`, `utils`, `lib` or `config`.

Features may import another feature's `api.js`, `keys.js` (to refresh its cache after a write),
`hooks.js` and `components/`, never its `pages/`. Nothing outside `src/app` imports from `src/app`.

```
src/
  app/          App, router (every route), providers, route guards, pages/ (403, 404, route error)
  config/       env validation, Firebase client
  constants/    shared.js (backend copy), ui.js (labels, tones, options, error tables)
  lib/          apiClient, envelope, queryClient, queryKeys, liveRefresh, formErrors, validators, csv, toastBus
  utils/        date, schedule, roles, names, format, grades, listParams, cx
  hooks/        useListParams, useDebounce, useDisclosure, useConfirm, useDiscardConfirm, useToast,
                useUnsavedChangesBlocker, ...
  components/
    ui/         domain-free building blocks (Button, DataTable, Modal, FormField, ...)
    layout/     AppShell, Sidebar, Topbar, PageHeader, PageSkeleton, DetailLoadError, guards' splash
                screens, DevProjectBanner, navConfig.js
  features/<feature>/
    keys.js     query keys            api.js     one function per endpoint (the only place with URLs)
    hooks.js    useQuery / useMutation  schemas.js zod schemas and form defaults
    components/ feature UI            pages/     one default export per page
```

Conventions: components, hooks and helpers are named exports; only pages are default exports (they are
lazy-loaded). Pages read the URL and compose; components take props; only `api.js` knows paths and unwraps
the `{ success, data, meta }` envelope, with `toData` and `toPage` from `lib/envelope.js`.

## Adding a feature page

1. Write the endpoint functions in `features/<feature>/api.js`:

   ```js
   export const listSubjects = (params) => api.get('/subjects', { params }).then(toPage); // { items, meta }
   export const createSubject = (body) => api.post('/subjects', body).then(toData);
   ```

2. Wrap them in `hooks.js` using the keys from `keys.js` (`subjectKeys = createKeys('subjects')`):

   ```js
   export const useSubjects = (params) =>
     useQuery({
       queryKey: subjectKeys.list(params),
       queryFn: () => listSubjects(params),
       placeholderData: keepPreviousData,
     });
   export function useCreateSubject() {
     const invalidate = useInvalidate();
     const toast = useToast();
     return useMutation({
       mutationFn: createSubject,
       onSuccess: (subject) => {
         invalidate(subjectKeys.all); // plus the keys of every other view that shows subjects
         toast.success(`${subject.name} created`);
       },
     });
   }
   ```

3. Write the page as the default export of a file in `features/<feature>/pages/`, then add its route to
   `src/app/router.jsx`, inside the matching `RequireRole` area, with `page(() => import('...'))`; add a
   sidebar entry in `components/layout/navConfig.js` if it needs one.

Error policy (in `lib/queryClient.js`): a first-load query error renders `<ErrorState>` in the page, a
background refetch error is a toast; a mutation error is a toast except validation errors and mapped
unique-key conflicts, which the form shows. A mutation whose form renders every error itself sets
`meta: { silent: true }`.

## List pattern

`useListParams` keeps page, limit, search, sorting and the declared filters in the URL. Declare exactly the
filters the endpoint accepts: the backend rejects unknown query parameters.

```jsx
// Boolean filters travel as 'true' and 'false'.
const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Retired' },
];

export default function SubjectsPage() {
  const list = useListParams({ filters: ['isActive'] });
  const { data, isPending, isFetching, error, refetch } = useSubjects(list.apiParams);
  const createModal = useDisclosure();

  const columns = [
    { key: 'code', header: 'Code', sortKey: 'code' },
    { key: 'name', header: 'Name', sortKey: 'name' },
    {
      key: 'isActive',
      header: 'Status',
      cell: (s) => <Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Active' : 'Retired'}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader title="Subjects" actions={<Button onClick={createModal.open}>Add subject</Button>} />
      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search code, name" />
        <Select
          aria-label="Status"
          value={list.params.isActive}
          onChange={(e) => list.setFilter('isActive', e.target.value)}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          className="sm:w-auto"
        />
      </FilterBar>
      <DataTable
        label="Subjects"
        columns={columns}
        rows={data?.items ?? []}
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }}
        onSortChange={list.setSort}
        emptyState={
          list.hasActiveFilters ? (
            <EmptyState
              title="No subjects match"
              action={
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState title="No subjects yet" />
          )
        }
      />
      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />
      <SubjectFormModal open={createModal.isOpen} onClose={createModal.close} />
    </>
  );
}
```

`sortKey` must be an entry of the endpoint's sort whitelist. `Select`, `Input` and `Textarea` pass the native
change event to `onChange`, like any input.

## Form and modal pattern

Forms are react-hook-form + a zod schema built from `lib/validators.js`. `FormField` wires the label, hint,
error and ARIA attributes to the one control it wraps. Server errors go through `applyServerErrors`, which
puts field errors under the fields and everything else in the root alert. The form lives in a child of
`Modal`, which mounts its children only while open, so it starts fresh every time. The modal owns the
mutation, so its footer's submit button shows the pending state and cannot submit twice.

```jsx
function SubjectForm({ create, onClose }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(subjectSchema),
    defaultValues: { code: '', name: '' },
  });
  const onSubmit = (values) =>
    create
      .mutateAsync(values)
      .then(onClose)
      .catch((e) => applyServerErrors(e, setError, { knownFields: Object.keys(subjectSchema.shape) }));

  return (
    <form id="subject-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField label="Code" error={errors.code?.message} required>
        <Input {...register('code')} />
      </FormField>
      <FormField label="Name" error={errors.name?.message} required>
        <Input {...register('name')} />
      </FormField>
    </form>
  );
}

export function SubjectFormModal({ open, onClose }) {
  const create = useCreateSubject();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add subject"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="subject-form" isLoading={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <SubjectForm create={create} onClose={onClose} />
    </Modal>
  );
}
```

A modal with more than three fields asks "Discard changes?" before it closes dirty:
`useDiscardConfirm(onClose)` returns `requestClose` for the modal and `trackDirty` for the form.

Destructive actions confirm first, and `useConfirm` reads top to bottom:

```jsx
const confirm = useConfirm();
if (
  await confirm({
    title: `Delete ${subject.name}?`,
    description: 'This cannot be undone.',
    confirmLabel: 'Delete',
  })
) {
  remove.mutate(subject.id);
}
```

Use `useUnsavedChangesBlocker(isDirty)` on pages and modals with unsaved work, and `useToast()` for
success messages that name the object that changed.
