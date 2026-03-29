export class NotificationService {
  static async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }

  static async notify(title: string, options?: NotificationOptions) {
    if (Notification.permission === "granted") {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.showNotification(title, {
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            ...options,
          });
        } else {
          new Notification(title, options);
        }
      } catch {
        new Notification(title, options);
      }
    }
  }
}
