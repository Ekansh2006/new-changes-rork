import { useCallback, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { GenderOption } from '@/types/profile';

export const [GenderFilterProvider, useGenderFilter] = createContextHook(() => {
  const [filterGender, setFilterGender] = useState<GenderOption | null>(null);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  const setUserGenderFilter = useCallback((gender: string | GenderOption) => {
    if (!gender) {
      return;
    }
    const normalized = gender.toString().trim().toLowerCase() as GenderOption;
    setFilterGender(normalized);
    setIsFiltering(true);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterGender(null);
    setIsFiltering(false);
  }, []);

  return useMemo(() => ({
    filterGender,
    isFiltering,
    setUserGenderFilter,
    clearFilter,
  }), [filterGender, isFiltering, setUserGenderFilter, clearFilter]);
});
