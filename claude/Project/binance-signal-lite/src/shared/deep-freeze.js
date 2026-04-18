const isObjectLike = (value) =>
  value !== null && (typeof value === "object" || typeof value === "function");

export const deepFreeze = (value) => {
  if (!isObjectLike(value) || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
};
