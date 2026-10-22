"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export const AuthSceneContext = createContext({
  isNight: true,
  setIsNight: () => {},
  toggleNight: () => {},
});

export function AuthSceneProvider({ children, initialNight = true }) {
  const [isNight, setIsNight] = useState(initialNight);

  const toggleNight = () => {
    setIsNight((prev) => !prev);
  };

  return (
    <AuthSceneContext.Provider value={{ isNight, setIsNight, toggleNight }}>
      {children}
    </AuthSceneContext.Provider>
  );
}

export function useAuthScene() {
  return useContext(AuthSceneContext);
}
