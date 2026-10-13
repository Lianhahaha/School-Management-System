import { ArrowRight, ChevronDown, CircleHelp, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchInput } from '../../../components/ui/SearchInput';
import { useAuth } from '../../auth/hooks';
import { HELP } from '../helpContent';

/** Entries of `entries` whose question or steps contain every word of `search`. */
function filterEntries(entries, search) {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return entries;
  return entries.filter((entry) => {
    const text = `${entry.question} ${entry.steps.join(' ')}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Entries grouped by topic, in the order the topics first appear. */
function byTopic(entries) {
  const groups = new Map();
  for (const entry of entries) groups.set(entry.topic, [...(groups.get(entry.topic) ?? []), entry]);
  return [...groups.entries()];
}

function Steps({ entry }) {
  return (
    <>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
        {entry.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {entry.to && (
        <Button as={Link} to={entry.to} variant="secondary" size="sm" icon={ArrowRight} className="mt-3">
          {entry.toLabel}
        </Button>
      )}
    </>
  );
}

/** One card per topic; each question opens to show its steps. While searching, the matches open by themselves. */
function QuestionList({ groups, isSearching }) {
  return (
    <div className="space-y-6">
      {groups.map(([topic, entries]) => (
        <Card key={topic} title={topic} padded={false}>
          <ul className="divide-y divide-gray-200">
            {entries.map((entry) => (
              <li key={entry.id}>
                <details className="group px-5 py-3.5" open={isSearching}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-gray-900">
                    {entry.question}
                    <ChevronDown
                      className="size-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="pt-3">
                    <Steps entry={entry} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/**
 * "How do I…?" answers for the signed-in role (helpContent), searchable. Linked from the sidebar.
 */
export default function HelpPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const groups = useMemo(() => byTopic(filterEntries(HELP[role] ?? [], search)), [role, search]);

  return (
    <>
      <PageHeader
        title="Help"
        description="Short answers to common questions, each with a button to the page it starts on."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        delay={150}
        label="Search help"
        placeholder="Search, e.g. assign teacher"
        className="mb-6"
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No answer matches"
          description="Try other words, or ask the school office."
        />
      ) : (
        <QuestionList groups={groups} isSearching={search !== ''} />
      )}
      <p className="mt-8 flex items-center gap-2 text-sm text-gray-600">
        <CircleHelp className="size-4" aria-hidden="true" />
        Still stuck? Ask the school office.
      </p>
    </>
  );
}
