import { useState, useEffect } from "react";
import {
  ActionPanel,
  Action,
  Grid,
  Clipboard,
  Toast,
  showToast,
  closeMainWindow,
  showHUD,
  getPreferenceValues,
} from "@raycast/api";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { showFailureToast } from "@raycast/utils";

interface ImageResult {
  link: string;
  title: string;
  displayLink: string;
}

interface GoogleSearchResponse {
  items?: ImageResult[];
  error?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [images, setImages] = useState<ImageResult[]>([]);

  const apiKey = getPreferenceValues<{ apiKey: string }>().apiKey;
  const cxId = getPreferenceValues<{ cxId: string }>().cxId;

  const searchImages = async (query: string) => {
    if (!query.trim()) {
      setImages([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}&searchType=image&num=10`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as GoogleSearchResponse;

      if (data.error) {
        console.error("API Error:", data.error);
        setImages([]);
        return;
      }

      setImages(data.items || []);
    } catch (error) {
      console.error("Error searching images:", error);
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchImages(searchText);
    }, 500); // Debounce search by 500ms

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  return (
    <Grid
      columns={4}
      isLoading={isLoading}
      fit={Grid.Fit.Fill}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for images..."
    >
      {images.map((image, index) => (
        <Grid.Item
          key={index}
          content={image.link}
          actions={
            <ActionPanel>
              <Action
                title="Copy Image to Clipboard"
                onAction={async () => {
                  try {
                    showToast({
                      title: "Copying image to clipboard...",
                      style: Toast.Style.Animated,
                    });

                    const data = await fetch(image.link);
                    const buffer = Buffer.from(await data.arrayBuffer());
                    const tempDir = os.tmpdir();
                    const tempFileName = `${randomUUID()}${image.link.split("/").pop() || ".png"}`;
                    const tempFile = path.join(tempDir, tempFileName);
                    await writeFile(tempFile, buffer);

                    Clipboard.copy({
                      file: tempFile,
                    });

                    closeMainWindow();

                    await showToast({
                      title: "Image copied to clipboard",
                      style: Toast.Style.Success,
                    });
                  } catch (error) {
                    await showFailureToast(error, {
                      title: "Error copying image to clipboard",
                    });
                  }
                }}
              />
              <Action.CopyToClipboard content={image.link} title="Copy Image URL" />
              <Action.OpenInBrowser url={image.link} title="Open Image in Browser" />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
