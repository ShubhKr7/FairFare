import toast from "react-hot-toast";

export const isAppOffline = () =>
  typeof navigator !== "undefined" && !navigator.onLine;

export const guardOfflineAction = (event) => {
  if (!isAppOffline()) return true;

  if (event?.preventDefault) event.preventDefault();
  toast.error("Please connect to the internet", {
    id: "offline-action",
    duration: 2000,
  });
  return false;
};
