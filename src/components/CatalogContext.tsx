"use client";

import { createContext, useContext } from "react";

export const CatalogRevisionContext = createContext(0);
export function useCatalogRevision(): number { return useContext(CatalogRevisionContext); }
