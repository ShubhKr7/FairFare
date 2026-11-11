const getDisplayName = (item) =>
  item?.username ||
  item?.user?.username ||
  item?.from?.username ||
  item?.friend?.username ||
  item?.friend?.name ||
  item?.name ||
  "";

export const sortByName = (items) =>
  [...items].sort((a, b) =>
    getDisplayName(a).localeCompare(getDisplayName(b), undefined, {
      sensitivity: "base",
    })
  );
