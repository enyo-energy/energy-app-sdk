import {ConnectEmsApi} from "./connect-ems-api.js";
import express, {type Request, type Response} from "express";

export class MockConnectEmsApi implements ConnectEmsApi {
    register(callback: (packageName: string, version: number) => void) {
        console.log('MockConnectEmsApi: Registering package with Connect EMS API');
        const app = express();
        app.use(express.json());
        app.get('/', (req: Request, res: Response) => {
        });
        app.listen(4001, () => {
            callback('com.example', 1);
        })
    }

    shutdown(callback: () => void) {
    }

    isOnline() {
        return true;
    }

}