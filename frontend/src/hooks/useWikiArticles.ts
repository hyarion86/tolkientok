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

  const fetchArticles = useCallback(async (forBuffer = false) => {
      // useCallback now depends on currentLanguage
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
          })
      );

      const data = await response.json();
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
        //fetchArticles(true); // Remove this recursive call here
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    }
    setLoading(false);
  }, [currentLanguage]); // fetchArticles now depends on currentLanguage

  const getMoreArticles = useCallback(() => {
    if (buffer.length > 0) {
      setArticles((prev) => [...prev, ...buffer]);
      setBuffer([]);
      fetchArticles(true); // Now calls the *correct* fetchArticles
    } else {
      fetchArticles(false);
    }
  }, [buffer, fetchArticles]); // getMoreArticles depends on fetchArticles

  // Use useEffect to trigger the initial fetch and refetch on language change
  useEffect(() => {
    setArticles([]); // Clear existing articles when the language changes
    setBuffer([]);    // Clear the buffer too
    fetchArticles(false); // Initial fetch
    // No need for a cleanup function; React handles this with the dependency array
  }, [fetchArticles]); // useEffect depends on fetchArticles (which depends on currentLanguage)

  return { articles, loading, fetchArticles: getMoreArticles };
}
