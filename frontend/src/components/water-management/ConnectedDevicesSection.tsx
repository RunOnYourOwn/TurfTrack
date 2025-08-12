import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Wifi, Clock } from "lucide-react";

export function ConnectedDevicesSection() {
  return (
    <Card className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Connected Devices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Device Integration Coming Soon
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
            We're working on integrating with sprinkler controllers, rain
            sensors, and weather stations for automatic data collection.
          </p>
          <Button variant="outline" disabled>
            In Development
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
