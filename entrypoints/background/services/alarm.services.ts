import { BrowserApplicationAlarmApi } from "./alarm.api";

export class AlarmService {
    constructor(private chromeApi: BrowserApplicationAlarmApi) { }

    getBroserApi() {
        return this.chromeApi;
    }
}