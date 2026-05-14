// Minimal local storage facade kept for future solo-mode persistence.
// It avoids pulling an unused IndexedDB dependency into the main web build.
export const soloDB = {
  conversations: {
    async toArray() {
      return [];
    },
  },
  skills: {
    async toArray() {
      return [];
    },
  },
};
