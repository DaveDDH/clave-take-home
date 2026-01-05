export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-muted px-4 py-3">
        <div className="flex gap-1">
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
