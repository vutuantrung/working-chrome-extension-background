import { BrowserApplicationAlarmApi } from "./alarm.api";

export class AlarmService {
    constructor(private browserAlarmApi: BrowserApplicationAlarmApi) { }

    getBrowserApi() {
        return this.browserAlarmApi;
    }
}