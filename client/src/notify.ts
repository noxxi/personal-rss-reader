// Toast notification system for visual feedback on async operations

export type NotificationType = 'pending' | 'success' | 'error' | 'info';

export interface NotifyOptions {
    type: NotificationType;
    message: string;
    duration?: number; // Auto-dismiss after duration (ms), 0 = no auto-dismiss
    delay?: number; // Delay before showing notification (ms), 0 = show immediately
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
    delayTimeoutId?: number; // For delayed display
    isVisible: boolean; // Whether notification has been shown yet
}

let container: HTMLElement | null = null;
let notifications: Map<string, Notification> = new Map();
let delayedNotifications: Map<string, number> = new Map(); // Track delayed show timers
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
 * Create notification element
 */
function createNotificationElement(id: string, options: NotifyOptions): HTMLElement {
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

    return element;
}

/**
 * Show notification element (add to DOM with animation)
 */
function showNotificationElement(notification: Notification): void {
    if (!container) {
        init();
    }

    // Add to container with animation
    container!.appendChild(notification.element);

    // Trigger reflow for animation
    notification.element.offsetHeight;
    notification.element.classList.add('notification-show');

    notification.isVisible = true;

    // Auto-dismiss if duration is set
    if (notification.duration > 0) {
        notification.timeoutId = window.setTimeout(() => {
            dismiss(notification.id);
        }, notification.duration);
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
                     (options.type === 'success' ? 2000 :
                      options.type === 'error' ? 5000 : 0);
    const delay = options.delay !== undefined ? options.delay : 0;

    // Create notification element
    const element = createNotificationElement(id, options);

    // Store notification
    const notification: Notification = {
        id,
        type: options.type,
        message: options.message,
        duration,
        onRetry: options.onRetry,
        element,
        isVisible: false
    };

    notifications.set(id, notification);

    // If delay is specified, schedule showing the notification
    if (delay > 0) {
        notification.delayTimeoutId = window.setTimeout(() => {
            notification.delayTimeoutId = undefined;
            showNotificationElement(notification);
        }, delay);
    } else {
        // Show immediately
        showNotificationElement(notification);
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

    // If notification is delayed and not yet visible
    if (notification.delayTimeoutId && !notification.isVisible) {
        clearTimeout(notification.delayTimeoutId);
        notification.delayTimeoutId = undefined;

        // If updating to success, don't show it (operation completed quickly)
        if (options.type === 'success') {
            notifications.delete(id);
            return;
        }

        // If updating to error, show it immediately
        if (options.type === 'error') {
            // Update notification properties before showing
            notification.type = 'error';
            notification.message = options.message || notification.message;
            notification.onRetry = options.onRetry;
            const duration = options.duration !== undefined ? options.duration : 5000;
            notification.duration = duration;

            // Re-create element with error state
            notification.element = createNotificationElement(id, {
                type: 'error',
                message: notification.message,
                onRetry: notification.onRetry
            });

            // Show the notification now
            showNotificationElement(notification);
            return;
        }
    }

    // Notification is already visible, update it in place

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
                     (options.type === 'success' ? 2000 :
                      options.type === 'error' ? 5000 : 0);
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

    // Clear timeouts if they exist
    if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
    }
    if (notification.delayTimeoutId) {
        clearTimeout(notification.delayTimeoutId);
    }

    // If not visible yet (still delayed), just remove from map
    if (!notification.isVisible) {
        notifications.delete(id);
        return;
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
    // Get visible notifications only
    const visibleIds: string[] = [];
    for (const [id, notification] of notifications) {
        if (notification.isVisible) {
            visibleIds.push(id);
        }
    }

    if (visibleIds.length === 0) {
        return false;
    }

    // Get the last visible notification (most recent)
    const lastId = visibleIds[visibleIds.length - 1];
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
    for (const notification of notifications.values()) {
        if (notification.isVisible) {
            return true;
        }
    }
    return false;
}

/**
 * Convenience function for pending notifications
 * Default delay is 2000ms (only show if operation takes longer than 2 seconds)
 */
export function pending(message: string, delay: number = 2000): string {
    return notify({ type: 'pending', message, delay });
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
