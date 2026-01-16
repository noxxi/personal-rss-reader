// Toast notification system for visual feedback on async operations

export type NotificationType = 'pending' | 'success' | 'error' | 'info';

export interface NotifyOptions {
    type: NotificationType;
    message: string;
    duration?: number; // Auto-dismiss after duration (ms), 0 = no auto-dismiss
    onRetry?: () => void; // Optional retry callback for error notifications
}

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    duration: number;
    onRetry?: () => void;
    element: HTMLElement;
    timeoutId?: number;
}

let container: HTMLElement | null = null;
let notifications: Map<string, Notification> = new Map();
let idCounter = 0;

/**
 * Initialize the notification system
 * Creates the container and sets up keyboard handlers
 */
export function init(): void {
    // Create container if it doesn't exist
    if (!container) {
        container = document.getElementById('notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications';
            document.body.appendChild(container);
        }
    }
}

/**
 * Generate a unique notification ID
 */
function generateId(): string {
    return `notify-${Date.now()}-${idCounter++}`;
}

/**
 * Get icon for notification type
 */
function getIcon(type: NotificationType): string {
    switch (type) {
        case 'pending':
            return '⏳';
        case 'success':
            return '✓';
        case 'error':
            return '✗';
        case 'info':
            return 'ℹ';
    }
}

/**
 * Create and show a notification
 * Returns the notification ID for later updates/dismissal
 */
export function notify(options: NotifyOptions): string {
    if (!container) {
        init();
    }

    const id = generateId();
    const duration = options.duration !== undefined ? options.duration :
                     (options.type === 'success' ? 2000 : 0);

    // Create notification element
    const element = document.createElement('div');
    element.className = `notification notification-${options.type}`;
    element.setAttribute('data-notification-id', id);
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');

    // Create content
    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = getIcon(options.type);

    const message = document.createElement('span');
    message.className = 'notification-message';
    message.textContent = options.message;

    element.appendChild(icon);
    element.appendChild(message);

    // Add retry button for errors
    if (options.type === 'error' && options.onRetry) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'notification-retry';
        retryBtn.textContent = 'Retry';
        retryBtn.onclick = (e) => {
            e.stopPropagation();
            if (options.onRetry) {
                options.onRetry();
            }
            dismiss(id);
        };
        element.appendChild(retryBtn);
    }

    // Add dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'notification-dismiss';
    dismissBtn.textContent = '×';
    dismissBtn.setAttribute('aria-label', 'Dismiss notification');
    dismissBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss(id);
    };
    element.appendChild(dismissBtn);

    // Click anywhere on notification to dismiss (except buttons which stop propagation)
    element.onclick = () => dismiss(id);

    // Add to container with animation
    container!.appendChild(element);

    // Trigger reflow for animation
    element.offsetHeight;
    element.classList.add('notification-show');

    // Store notification
    const notification: Notification = {
        id,
        type: options.type,
        message: options.message,
        duration,
        onRetry: options.onRetry,
        element
    };

    notifications.set(id, notification);

    // Auto-dismiss if duration is set
    if (duration > 0) {
        notification.timeoutId = window.setTimeout(() => {
            dismiss(id);
        }, duration);
    }

    return id;
}

/**
 * Update an existing notification
 * Useful for changing a pending notification to success/error
 */
export function update(id: string, options: Partial<NotifyOptions>): void {
    const notification = notifications.get(id);
    if (!notification) {
        return;
    }

    // Clear existing timeout
    if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
        notification.timeoutId = undefined;
    }

    // Update type if provided
    if (options.type && options.type !== notification.type) {
        notification.type = options.type;
        notification.element.className = `notification notification-${options.type} notification-show`;

        // Update icon
        const iconEl = notification.element.querySelector('.notification-icon');
        if (iconEl) {
            iconEl.textContent = getIcon(options.type);
        }
    }

    // Update message if provided
    if (options.message) {
        notification.message = options.message;
        const messageEl = notification.element.querySelector('.notification-message');
        if (messageEl) {
            messageEl.textContent = options.message;
        }
    }

    // Update duration and set new timeout
    const duration = options.duration !== undefined ? options.duration :
                     (options.type === 'success' ? 2000 : 0);
    notification.duration = duration;

    // Add/remove retry button if needed
    const existingRetry = notification.element.querySelector('.notification-retry');
    if (options.type === 'error' && options.onRetry) {
        notification.onRetry = options.onRetry;

        if (!existingRetry) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'notification-retry';
            retryBtn.textContent = 'Retry';
            retryBtn.onclick = (e) => {
                e.stopPropagation();
                if (options.onRetry) {
                    options.onRetry();
                }
                dismiss(id);
            };

            // Insert before dismiss button
            const dismissBtn = notification.element.querySelector('.notification-dismiss');
            if (dismissBtn) {
                notification.element.insertBefore(retryBtn, dismissBtn);
            }
        }
    } else if (existingRetry) {
        existingRetry.remove();
        notification.onRetry = undefined;
    }

    // Auto-dismiss if duration is set
    if (duration > 0) {
        notification.timeoutId = window.setTimeout(() => {
            dismiss(id);
        }, duration);
    }
}

/**
 * Dismiss a notification
 */
export function dismiss(id: string): void {
    const notification = notifications.get(id);
    if (!notification) {
        return;
    }

    // Clear timeout if exists
    if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
    }

    // Fade out animation
    notification.element.classList.remove('notification-show');
    notification.element.classList.add('notification-hide');

    // Remove from DOM after animation
    setTimeout(() => {
        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
        notifications.delete(id);
    }, 200); // Match fadeOut animation duration
}

/**
 * Dismiss the topmost (most recent) notification
 * Used for ESC key handler
 */
export function dismissTop(): boolean {
    if (notifications.size === 0) {
        return false;
    }

    // Get the last notification (most recent)
    const ids = Array.from(notifications.keys());
    const lastId = ids[ids.length - 1];
    dismiss(lastId);
    return true;
}

/**
 * Dismiss all notifications
 */
export function dismissAll(): void {
    const ids = Array.from(notifications.keys());
    ids.forEach(id => dismiss(id));
}

/**
 * Check if any notifications are visible
 */
export function hasVisibleNotifications(): boolean {
    return notifications.size > 0;
}

/**
 * Convenience function for pending notifications
 */
export function pending(message: string): string {
    return notify({ type: 'pending', message });
}

/**
 * Convenience function for success notifications
 */
export function success(message: string, duration: number = 2000): string {
    return notify({ type: 'success', message, duration });
}

/**
 * Convenience function for error notifications
 */
export function error(message: string, onRetry?: () => void): string {
    return notify({ type: 'error', message, onRetry, duration: 0 });
}

/**
 * Convenience function for info notifications
 */
export function info(message: string, duration: number = 3000): string {
    return notify({ type: 'info', message, duration });
}
