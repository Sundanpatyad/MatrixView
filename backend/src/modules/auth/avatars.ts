import { Types } from 'mongoose';
import { User } from './models/User.js';

/** Batch-load profile photo URLs keyed by user id */
export async function loadAvatarMap(
  userIds: Array<string | null | undefined>,
): Promise<Map<string, string | null>> {
  const ids = [
    ...new Set(
      userIds.filter(
        (id): id is string => Boolean(id) && Types.ObjectId.isValid(String(id)),
      ),
    ),
  ];
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;

  const users = await User.find({ _id: { $in: ids } })
    .select('_id avatarUrl')
    .lean();

  for (const u of users) {
    map.set(String(u._id), u.avatarUrl ?? null);
  }
  return map;
}
