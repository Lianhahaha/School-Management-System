import { useId, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { cx } from '../../utils/cx';

/**
 * Tabs whose active tab lives in the URL (`?tab=students`), so reload, back/forward and shared links
 * keep the tab. Only the active panel is rendered: a tab's queries do not run until it is opened.
 * Switching tabs drops the other query parameters, because each tab owns its own list state.
 * Arrow keys, Home and End move between tabs.
 *
 *   <Tabs label="Class sections" tabs={[
 *     { id: 'subjects', label: 'Subjects & Teachers', content: <ClassSubjectsTab classId={id} /> },
 *     { id: 'students', label: 'Students', content: <ClassStudentsTab classId={id} /> },
 *   ]} />
 *
 * The first tab is active when `?tab=` is missing or unknown.
 *
 * @param {object} props
 * @param {string} props.label accessible name of the tab list
 * @param {Array<{ id: string, label: string, content: import('react').ReactNode }>} props.tabs
 * @param {string} [props.param] query parameter name (default 'tab')
 */
export function Tabs({ label, tabs, param = 'tab' }) {
  const baseId = useId();
  const listRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === searchParams.get(param)),
  );

  const select = (index) => setSearchParams({ [param]: tabs[index].id });

  function onKeyDown(event) {
    const lastIndex = tabs.length - 1;
    const nextIndex = {
      ArrowRight: activeIndex === lastIndex ? 0 : activeIndex + 1,
      ArrowLeft: activeIndex === 0 ? lastIndex : activeIndex - 1,
      Home: 0,
      End: lastIndex,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    select(nextIndex);
    listRef.current.querySelectorAll('[role="tab"]')[nextIndex].focus();
  }

  const tabId = (tab) => `${baseId}-tab-${tab.id}`;
  const panelId = (tab) => `${baseId}-panel-${tab.id}`;
  const activeTab = tabs[activeIndex];

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-gray-200"
      >
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={tab.id}
              id={tabId(tab)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId(tab)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(index)}
              className={cx(
                '-mb-px min-h-10 border-b-2 px-4 text-sm font-medium whitespace-nowrap',
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={panelId(activeTab)}
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
        tabIndex={0}
        className="pt-6"
      >
        {activeTab.content}
      </div>
    </div>
  );
}
