import { useState, useCallback } from "react";
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

  const fetchArticles = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${currentLanguage.api}?${new URLSearchParams({
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
        })}`
      );

      if (!response.ok) {
        throw new Error(`Error fetching articles: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.query) {
        throw new Error("No query in response");
      }

      const newArticles = Object.values(data.query.pages)
        .map((page: any): WikiArticle => ({
          title: page.title,
          extract: page.extract,
          pageid: page.pageid,
          thumbnail: page.thumbnail,
          url: page.canonicalurl,
        }))
        .filter(
          (article) =>
            article.thumbnail &&
            article.thumbnail.source &&
            article.url &&
            article.extract
        );

      await Promise.allSettled(
        newArticles
          .filter((article) => article.thumbnail)
          .map((article) => preloadImage(article.thumbnail!.source))
      );

      setBuffer((prev) => [...prev, ...newArticles]);
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMoreArticles = useCallback(() => {
    if (loading) return; // Prevent fetching while already loading
    if (buffer.length > 0) {
      setArticles((prev) => [...prev, ...buffer]);
      setBuffer([]);
    } else {
      fetchArticles();
    }
  }, [buffer, loading]);

  return { articles, loading, fetchArticles: getMoreArticles };
}
