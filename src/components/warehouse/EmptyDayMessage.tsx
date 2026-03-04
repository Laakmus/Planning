/**
 * Komunikat pustego dnia — brak zaplanowanych operacji.
 */

export function EmptyDayMessage() {
  return (
    <div className="text-center p-4">
      <p className="text-xs font-medium text-muted-foreground italic">
        Brak zaplanowanych operacji
      </p>
    </div>
  );
}
