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
        className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-gray-100 p-1"
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
                'min-h-9 rounded-full px-4 text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-surface font-semibold text-gray-900 shadow-[0_1px_3px_rgb(24_24_27/0.1)]'
                  : 'font-medium text-gray-600 hover:text-gray-900',
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
