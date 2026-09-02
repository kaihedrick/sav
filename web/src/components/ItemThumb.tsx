import { useEffect, useState } from "react";
import { itemEmoji } from "../lib/inventoryCardStyle";

export function ItemThumb({
  name,
  category,
  imageUrl,
  className = "h-14 w-14",
  emojiClassName = "text-2xl",
}: {
  name: string;
  category: string;
  imageUrl?: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const showImg = Boolean(imageUrl) && !failed;

  return (
    <span
      className={`flex shrink-0 overflow-hidden rounded-xl border border-bob-mist bg-white/80 shadow-sm ${className}`}
      aria-hidden
    >
      {showImg ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center bg-bob-mist/40 ${emojiClassName}`}
        >
          {itemEmoji(name, category)}
        </span>
      )}
    </span>
  );
}
