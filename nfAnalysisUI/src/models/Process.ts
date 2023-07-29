export default class Process {

    run_id: string;
    process: string;
    script: string;
    read_bytes: number;
    peak_rss: number;
    tag: any[];
    time: number;
    write_bytes: number;
    vol_ctxt: number;
    id: number;
    cpus: number;
    realtime: number;
    inv_ctxt: number;
    scratch: boolean;
    token: string;
    memory: number;
    cpu_percentage: number;
    memory_percentage: number;
    event: string;
    run_name: string;
    disk: number;
    rchar: number;
    vmem: number;
    timestamp: Date;
    duration: number;
    wchar: number;
    rss: number;
    task_id: number;
    name: string;
    syscr: number;
    peak_vmem: number;
    status: string;
    attempt: number;
    syscw: number;

    constructor(data: any) {
        this.run_id = data.run_id;
        this.process = data.process;
        this.script = data.script;
        this.peak_rss = data.rss;
        this.tag = this.setTagsFromData(data.tag);
        this.time = data.time;
        this.write_bytes = data.write_bytes;
        this.read_bytes = data.read_bytes;
        this.vol_ctxt = data.vol_ctxt;
        this.id = data.id;
        this.cpus = data.cpus;
        this.realtime = data.realtime;
        this.inv_ctxt = data.inv_ctxt;
        this.scratch = data.scratch;
        this.token = data.token;
        this.memory = data.memory;
        this.cpu_percentage = data.cpu_percentage;
        this.memory_percentage = data.memory_percentage;
        this.event = data.event;
        this.run_name = data.run_name;
        this.disk = data.disk;
        this.rchar = data.rchar;
        this.vmem = data.vmem;
        this.timestamp = data.timestamp;
        this.duration = data.duration;
        this.wchar = data.wchar;
        this.rss = data.rss;
        this.task_id = data.task_id;
        this.name = data.name;
        this.syscr = data.syscr;
        this.peak_vmem = data.peak_vmem;
        this.status = data.status;
        this.attempt = data.attempt;
        this.syscw = data.syscw;
    }

    public getTags(): any[] {
        return this.tag;
    }

    public setTagsFromData(tagString: string): any[] {
        let keyValuePairs: any[] = [];
        if (tagString !== null) {
            let stringParts: string[] = tagString.split(',');
            for (let part of stringParts) {
                let pair: any = {}
                let partParts: string[] = part.split(':');
                if (partParts.length > 1) {
                    pair[partParts[0].trim()] = partParts[1].trim();
                } else {
                    pair['_'] = partParts[0];
                }
                keyValuePairs.push(pair);
            }
        } else {
            return [{"": null}]
        }
        
        return keyValuePairs;
    }

}
