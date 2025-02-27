import { useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { parse, stringify } from "qs";

interface QueryParams {
  [key: string]: any;
}

const useQueryParams = (initialParams?: QueryParams) => {
  const { search } = useLocation();
  const navigate = useNavigate();

  const query = useMemo(() => {
    const searchQuery = search.substring(1);

    if (!search) {
      return initialParams;
    }

    return parse(searchQuery);
  }, [search, initialParams]);

  const setQuery = useCallback(
    (nextParams: QueryParams, method: 'push' | 'remove' = "push") => {
      let nextQuery = { ...query };

      if (method === "remove") {
        Object.keys(nextParams).forEach((key) => {
          delete nextQuery[key];
        });
      } else {
        nextQuery = { ...query, ...nextParams };
      }

      navigate({ search: stringify(nextQuery, { encode: false }) });
    },
    [navigate, query]
  );

  return { query, rawQuery: search, setQuery };
};

export default useQueryParams; 