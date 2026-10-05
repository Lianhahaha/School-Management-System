import { z } from 'zod';
import { boolQuery, idList, listQuery } from '../../utils/zod/common.js';
import { NOTIFICATION_SORT_MAP } from './notifications.repository.js';

export const listNotificationsQuery = listQuery(
  Object.keys(NOTIFICATION_SORT_MAP),
  { unread: boolQuery.optional() },
  { searchable: false },
);

/** `ids` left out marks every unread notification of the caller read. */
export const markReadBody = z.strictObject({ ids: idList.optional() });
