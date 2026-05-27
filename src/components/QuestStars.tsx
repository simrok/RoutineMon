interface QuestStarsProps {
  total: number;
  completed: number;
}

export default function QuestStars({ total, completed }: QuestStarsProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < completed;
        return (
          <span
            key={i}
            className="text-xl"
            style={{
              color: isDone ? '#F5A6D6' : '#7FE7D8',
              textShadow: isDone ? '0 0 6px #F5A6D6' : '0 0 6px #7FE7D8',
            }}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}