import { useState, useCallback, useEffect } from "react";
import { useLocalization } from "./useLocalization";
import type { WikiArticle } from "../components/WikiCard";

const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve();
    img.onerror = reject;
  });
};

export function useWikiArticles() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [buffer, setBuffer] = useState<WikiArticle[]>([]);
  const { currentLanguage } = useLocalization();

  // useCallback is ESSENTIAL here. fetchArticles depends on currentLanguage
  const fetchArticles = useCallback(async (forBuffer = false) => {
    // Create an AbortController for each fetch
    const controller = new AbortController();
    const signal = controller.signal;


    // Early return if already loading.  This is still important,
    // but it's not the primary fix.
    if (loading) {
        return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        currentLanguage.api +
          new URLSearchParams({
            action: "query",
            format: "json",
            generator: "random",
            grnnamespace: "0",
            prop: "extracts|pageimages|info",
            inprop: "url",
            grnlimit: "20",
            exintro: "1",
            exlimit: "max",
            exsentences: "5",
            explaintext: "1",
            piprop: "thumbnail",
            pithumbsize: "400",
            origin: "*",
          }),
        { signal } // Pass the AbortSignal to fetch
      );

      if (!response.ok) { //Check if request was not ok.
          throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle potential errors in the response
      if (!data.query || !data.query.pages) {
        console.error("Unexpected API response:", data);
        setLoading(false); // Ensure loading is set to false on error
        return; // Exit early
      }

      const newArticles = Object.values(data.query.pages)
        .map((page: any): WikiArticle => ({
          title: page.title,
          extract: page.extract,
          pageid: page.pageid,
          thumbnail: page.thumbnail,
          url: page.canonicalurl,
        }))
        .filter((article) => article.thumbnail
                           && article.thumbnail.source
                           && article.url
                           && article.extract);


      await Promise.allSettled(
        newArticles
          .filter((article) => article.thumbnail)
          .map((article) => preloadImage(article.thumbnail!.source))
      );

      if (forBuffer) {
        setBuffer(newArticles);
      } else {
        setArticles((prev) => [...prev, ...newArticles]);
        // Removed recursive call.
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Fetch aborted'); // Expected, not an error
      } else {
        console.error("Error fetching articles:", error);
      }
    } finally {
        setLoading(false); //set Loading to false in the finally block
    }
  }, [currentLanguage, loading]); // Depend on currentLanguage AND loading

    const getMoreArticles = useCallback(() => {
        if (buffer.length > 0) {
            setArticles((prev) => [...prev, ...buffer]);
            setBuffer([]);
            fetchArticles(true);
        } else {
            fetchArticles(false);
        }
    }, [buffer, fetchArticles]);

  useEffect(() => {
    // 1. Clear existing articles
    setArticles([]);
    setBuffer([]);

    // 2. Initial fetch
    fetchArticles(false);

    // 3. Cleanup function: Abort any in-flight requests
    return () => {
        // We need to abort the fetch, but fetchArticles is a useCallback
        // And it is torn down each render, but we can abort inside the function.

    };
  }, [fetchArticles]); // Depend on fetchArticles

  return { articles, loading, fetchArticles: getMoreArticles };
}
