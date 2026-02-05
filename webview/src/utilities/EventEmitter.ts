export type Listener<T> = (event: T) => void;

export interface IDisposable {
    dispose(): void;
}

export interface Event<T> {
    (listener: Listener<T>): IDisposable;
}

export class EventEmitter<T> implements IDisposable {
    private listeners: Set<Listener<T>> = new Set();

    get event(): Event<T> {
        return (listener: Listener<T>) => {
            this.listeners.add(listener);
            return {
                dispose: () => {
                    this.listeners.delete(listener);
                },
            };
        };
    }

    fire(event: T): void {
        this.listeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.error("Error in event listener:", error);
            }
        });
    }

    dispose(): void {
        this.listeners.clear();
    }
}
