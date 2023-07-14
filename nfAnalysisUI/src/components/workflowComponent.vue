<script setup lang="ts">
import { onMounted, reactive, setTransitionHooks, toRaw, watch } from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import { useRouter, useRoute } from "vue-router";
import axios from "axios";
import { Chart, LinearScale, CategoryScale} from 'chart.js/auto';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import ProgressBar from 'primevue/progressbar';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';


/**
 * 
 * We need a function that transforms the indexes of the tasks per process into menuItem-like objects
 * So we can use these menu items to toggle between the tasks in a process accordion
 * 
 * */

 Chart.register(BoxPlotController, BoxAndWiskers, LinearScale, CategoryScale);

const router = useRouter();
const route = useRoute();

const props = defineProps<{
    token: string;
}>();

const workflowState = reactive<{
    loading: boolean;
    token: string;
    token_info_requested: boolean
    chart: any;
    error_on_request: boolean;
    process_state: any;
    state_by_task: any;
    //connection: WebSocket;
}>({
    loading: true,
    token: "",
    token_info_requested: false,
    chart: {},
    error_on_request: false,
    process_state: {},
    state_by_task: {},
    //connection: null,
});

function getData(token = props.token) {
    if (token.length > 0) {
        workflowState.loading = true;
        axios.get(`http://localhost:8000/run/${token}/`).then(
            response => {
                if (response.data["error"]) {
                    workflowState.state_by_task = [];
                    workflowState.error_on_request = true;

                } else {
                    workflowState.state_by_task = response.data["result_by_task"];
                    workflowState.process_state = response.data["result_processes"];
                    workflowState.token_info_requested = true;
                    workflowState.token = token;
                    workflowState.error_on_request = false;
                    generateChart();
                    generateMemoryChart();
                }
            },
        );
        //workflowState.connection = new WebSocket(`wss://localhost:8000/run/${token}`);
        //workflowState.connection. TODO: add websocket stuff

    }

}

function sortTraces(a: RunTrace, b: RunTrace): number {
    if (Date.parse(a.timestamp) < Date.parse(b.timestamp)) {
        return -1;
    } else {
        return 1;
    }
}

function getProgressValue(task: any): number {
    let x: number = 0
    if (task["status"] === "SUBMITTED") {
        x = 10
    } else if (task["status"] === "RUNNING") {
        x = 50
    } else if (task["status"] === "COMPLETED") {
        x = 100
    }
    return x;
}

function processNumbers(info: any): string {
    const currently_submitted: number = getNumberOfTasksForProcess(info);
    const completed = getNumberOfCompletedSubprocesses(info);
    return `${completed} / ${currently_submitted}`;
}

function getNumberOfTasksForProcess(info: any): number {
    const subprocesses: any = info["tasks"];
    let currently_submitted: number = 0;
    for (let elem in subprocesses) {
        currently_submitted += 1;
    }
    return currently_submitted
}

function getProcessCurrentScore(info: any): number {
    const subprocesses: any = info["tasks"];
    let score: number = 0;
    for (let sb in subprocesses) {
        let status: string = subprocesses[sb]["status"];
        if (status == "SUBMITTED") {
            score += 10;
        } else if (status == "RUNNING") {
            score += 50;
        } else if (status == "COMPLETED") {
            score += 100;
        }
    }
    return score;
}


function getNumberOfCompletedSubprocesses(info: any): number {
    const subprocesses: any = info["tasks"];
    let completed: number = 0;
    for (let sb in subprocesses) {
        if (subprocesses[sb]["status"] === "COMPLETED") {
            completed += 1;
        }
    }
    return completed;
}

function deleteToken(token: string) {
    // needs implementation
}
/*
function generateChart() { OLD
    let x_data = workflowState.run_traces.map((trace: RunTrace) => Date.parse(trace.timestamp));
    let y_data = workflowState.run_traces.map((trace: RunTrace) => trace.memory);
    let data = workflowState.run_traces.map((trace: RunTrace) => new Object({"date": trace.timestamp, "memory": trace.memory }));
    const width = 800;
    const height = 500;
    // TODO: continue chart stuff here
} */

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateData(): any[] {
    let data = [];
    for (let process in workflowState.process_state) {
        const tasks = workflowState.process_state[process].tasks
        for (let tsk in tasks) {
            data.push({ process: process, duration: tasks[tsk]['duration'] });
            break;
        }

    }
    return data;

}


function getDataInValidFormat(byte_numbers: number[]): [number[], string] {
    const types: string[] = ['b', 'kiB', 'MiB', 'GiB'];
    let iteration: number = 0;
    
    if (byte_numbers.length > 0) {
        while(byte_numbers.some(elm => elm > 10000) && iteration < types.length - 1) {
            byte_numbers = byte_numbers.map((num): number => num / 1024);
            iteration++;
        }        
    }
    return [byte_numbers, types[iteration]]
    
    
    
}

function generateMemoryData(): any {
    let data_pair: any = {};
    data_pair["labels"] = [];
    data_pair["data"] = [];
    data_pair["type"] = 'byte';
    console.log(toRaw(workflowState.process_state));
    for (let process in workflowState.process_state) {
        let min: number = Number.MAX_SAFE_INTEGER;
        let max: number = 0;
        for (let task: any in workflowState.process_state[process]['tasks']) {
            let tsk: any = workflowState.process_state[process]['tasks'][task];
            if (tsk["memory"] > max) {
                max = tsk["memory"];
            }
            if (tsk["memory"] !== null) {
                if (tsk["memory"] < min) {
                    min = tsk["memory"];
                }
            }
            
            data_pair["labels"].push(process);
            if (min == Number.MAX_SAFE_INTEGER) {
                min = 0;
                console.log("its")
            }
            const adjusted: [number[], string] = getDataInValidFormat([min, max]);

            data_pair["data"].push(adjusted[0])
            data_pair["type"] = adjusted[1];
        }
    }
    console.log(data_pair);
        // fix errors
    return data_pair;

}


 


// how to combine the metrics from currentState and process state - what about meta? 
// more data from api needed - otherwise no possibility to show all relevant metrics
// check chart.js and available visualizations in nf-tower


async function generateChart() {
    // needs a lot of future adjustments
    let datax = generateData();
    await delay(100);
    new Chart(
        document.getElementById('chartarea'),
        {
            type: 'bar',
            options: {
                animation: true,
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        enabled: true
                    }

                }
            },
            data: {
                labels: datax.map(row => row.process),
                datasets: [
                    {
                        label: 'Duration in seconds',
                        data: datax.map(row => (row.duration / 1000))
                    }
                ]
            }
        }
    );


}

async function generateMemoryChart() {
    // adjust here - get the data in the function to display ranges and so on.
    //let data = generateMemoryData();
    await delay(300);
    new Chart(
        document.getElementById('memory_chart_area'),
        {
            type: 'boxplot',
            options: {
                responsive: true,
                animation: true,
                plugins: {
                    legend: {
                        display: true
                    },
                    tooltip: {
                        enabled: true
                    }

                }
            },
            data: {
                // labels: data.map(row => row.process)
                labels: ['A'],
                datasets: 
                    [
                        {
                        label: `Used Memory in whatever`,
                        //data: data["data"],
                        data: [[1,2,34,5,17,2]],
                    }   
                ],
                
                
            },
            
        }
    );
}

onMounted(() => {
    getData();
});
</script>

<template>
    <div class="card" v-if="!workflowState.token || workflowState.error_on_request">
        <h5 class="card-header">Enter token</h5>
        <div class="card-body">
            <div class="alert"
                :class="{ 'alert-dark': !workflowState.error_on_request, 'alert-danger': workflowState.error_on_request }">
                Please enter a valid token to show the corresponding workflow information for this token.
                <strong>The entered token is not valid.</strong>
            </div>
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Token</span>
                <input v-model="workflowState.token" type="text" class="form-control" placeholder="Token" aria-label="token"
                    aria-describedby="basic-addon1">
                <button @click="getData(workflowState.token)" class="btn btn-outline-primary" type="button">Show</button>
            </div>
        </div>
    </div>
    <div v-if="workflowState.token && workflowState.token_info_requested">
        <h5 class="card-header">Workflow information for token {{ workflowState.token }}</h5>
        <div class="card-body" v-if="workflowState.state_by_task?.length == 0 && !workflowState.error_on_request">
            <h6 class="card-subtitle mb-2">
                There are no workflows connected to this token. Please use the following instructions to persist workflow
                metrics to this token.
            </h6>
            <div class="alert alert-dark">
                The following steps need to be taken:
                <ul>
                    <li>Take a look at the current token - the full token is: <strong>{{ workflowState.token }}</strong> </li>
                    <li>Start your nextflow workflow as you are used to. Just add the following command line arguments to
                        the execution:
                        <strong>{{ `-with-weblog http://localhost:8000/run/${workflowState.token}/` }}</strong>
                    </li>
                </ul>
                So your command to execute will look similar to this: <br>
                <span class="text-muted">./nextflow run nextflow-io/elixir-workshop-21 -r master -with-docker -with-weblog
                    http://localhost:8000/run/{{ workflowState.token }}</span>
                <br>
                As soon as the first metrics have been sent to the token-specific-endpoint, you will be able to see the
                progress here.
            </div>
        </div>
        <div class="card-body"
            v-if="workflowState.token_info_requested && workflowState.state_by_task?.length > 0 && !workflowState.error_on_request && workflowState.process_state">
            <h5 class="card-title">By process</h5>
            <hr>

            <div v-for="(info, process) in workflowState.process_state" :id="process + '_accordion'">
                <Accordion>
                    <AccordionTab>
                        <template #header>
                            <span>{{ process }} - {{ processNumbers(info) }} Completed</span>

                        </template>
                        <div>
                            <Card>
                                <template #title> Metrics </template>
                                <template #content>
                                    <ProgressBar
                                        :value="(getProcessCurrentScore(info) / (getNumberOfTasksForProcess(info) * 100)) * 100"
                                        :pt="{
                                            root: { style: { height: '3px' } },
                                            value: { style: { height: '3px' } },
                                            label: { style: { display: 'none' } },
                                        }"></ProgressBar>
                                    <TabView>
                                        <TabPanel v-for="(task, id) in info['tasks']" :header="`#${id}`">

                                            <div class="table-responsive">
                                                <table class="table align-middle">
                                                    <thead>
                                                        <tr>
                                                            <th scope="col">Name</th>
                                                            <th scope="col">CPUs</th>
                                                            <th scope="col">Memory</th>
                                                            <th scope="col">Disk</th>
                                                            <th scope="col">Duration</th>
                                                            <th scope="col">Realtime</th>
                                                            <th scope="col">wchar</th>
                                                            <th scope="col">rchar</th>
                                                            <th scope="col">rss</th>
                                                            <th scope="col">%cpu</th>
                                                            <th scope="col">%mem</th>
                                                            <th scope="col">Virtual Memory</th>
                                                            <th scope="col">peak VMem</th>
                                                            <th scope="col">syscr</th>
                                                            <th scope="col">syscw</th>
                                                            <th scope="col">peak rss</th>
                                                            <th scope="col">Read bytes</th>
                                                            <th scope="col">Written bytes</th>
                                                            <th scope="col">Voluntary CTXT</th>
                                                            <th scope="col">Involuntary CTXT</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>

                                                        <tr>
                                                            <th scope="row">{{ `${process}${task['sub_task'] != null ? ':' +
                                                                task['sub_task'] : ''}` }}</th>
                                                            <td>{{ task["cpus"] }}</td>
                                                            <td>{{ task["memory"] / 1024}} kiB</td>
                                                            <td>{{ task["disk"] }}</td>
                                                            <td>{{ (task["duration"] / 1000) }} s</td>
                                                            <td>{{ task["realtime"] / 1000 }} s</td>
                                                            <td>{{ task["wchar"] / 1024 }} kiB</td>
                                                            <td>{{ task["rchar"] / 1024 }} kiB</td>
                                                            <td>{{ task["rss"] / 1024}} kiB </td>
                                                            <td>{{ task["cpu_percentage"]}}</td>
                                                            <td>{{ task["memory_percentage"] }}</td>
                                                            <td>{{ task["vmem"] / 1024 }} kiB</td>
                                                            <td>{{ task["peak_vmem"] / 1024}} kiB</td>
                                                            <td>{{ task["syscr"] }}</td>
                                                            <td>{{ task["syscw"] }}</td>
                                                            <td>{{ task["peak_rss"] }}</td>
                                                            <td>{{ task["read_bytes"] }}</td>
                                                            <td>{{ task["write_bytes"] }}</td>
                                                            <td>{{ task["vol_ctxt"] }}</td>
                                                            <td>{{ task["inv_ctxt"] }}</td>

                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </TabPanel>
                                    </TabView>

                                </template>


                            </Card>


                        </div>
                    </AccordionTab>
                </Accordion>

            </div>


            <hr>
            <div class="card-body">
                <h5 class="card-title">Trace Information</h5>

                <DataTable :value="workflowState.state_by_task" sortField="task_id" :sortOrder="1"
                    tableStyle="min-width: 50rem" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" removableSort>
                    <Column field="task_id" header="Task-ID" sortable></Column>
                    <Column field="name" header="Name" sortable></Column>
                    <Column field="status" header="Status" sortable>
                        <template #body="{ data }">
                            <Tag :value="data.status" />
                        </template>
                    </Column>
                    <Column field="process" header="Process" sortable></Column>
                    <Column field="tag" header="Tag" sortable></Column>
                    <Column field="timestamp" header="Timestamp" sortable></Column>
                    <Column field="duration" sortable header="Duration">
                        <template #body="{ data }">
                            {{ (data.duration / 1000) }} s
                        </template>
                    </Column>
                    <Column field="cpu_percentage" header="CPU %" sortable></Column>
                    <Column field="memory_percentage" header="Memory %" sortable></Column>
                    <Column field="memory" header="Memory">
                        <template #body="{ data }">
                            {{ (data.memory / 1024) }} kiB
                        </template>
                    </Column>
                    <Column field="disk" header="Disk"></Column>
                    <Column field="rchar" header="rchar" sortable>
                        <template #body="{ data }">
                            {{ data.rchar / 1024 }} kiB
                        </template></Column>
                    <Column field="wchar" header="wchar" sortable>
                        <template #body="{ data }">
                            {{ data.wchar / 1024 }} kiB
                        </template></Column>
                    <Column field="rss" header="rss" sortable>
                        <template #body="{ data }">
                            {{ data.rss / 1024}} kiB
                        </template>
                    </Column>
                    <Column field="peak_rss" header="Peak rss" sortable></Column>
                    <Column field="syscr" header="syscr" sortable></Column>
                    <Column field="syscw" header="syscw" sortable></Column>
                    <Column field="peak_vmem" header="Peak VMem" sortable>
                        <template #body="{ data }">
                            {{ (data.peak_vmem / 1024) }} kiB
                        </template>
                    </Column>
                    <Column field="vmem" header="VMem" sortable>
                        <template #body="{ data }">
                            {{ data.vmem / 1024 }} kiB
                        </template>
                    </Column>
                    <Column field="read_bytes" header="Read bytes" sortable></Column>
                    <Column field="write_bytes" header="Written bytes" sortable>
                    </Column>
                    <Column field="vol_ctxt" header="Voluntary context switches" sortable></Column>
                    <Column field="inv_ctxt" header="Involuntary cs" sortable></Column>
                    <Column field="time" header="Time" sortable></Column>
                    <Column field="realtime" header="Realtime" sortable>
                        <template #body="{ data }">
                            {{(data.realtime / 1000)}} s
                         </template>
                    </Column>
                    <Column field="tag" header="Tag" sortable></Column>
                </DataTable>
            </div>
        </div>
        <div class="card-body">
            <h5 class="card-title">Visualization</h5>
            <h6>Duration</h6> <!-- adjust to have this in chartjs itself -->
            <div style="width: 800px;"><canvas id="chartarea"></canvas></div>
        </div>
        <hr>
        <div class="card-body">
            <h6>Memory usage</h6>
            <div style="width: 800px;">
                <canvas id="memory_chart_area"></canvas>
            </div>
        </div>
        <div class="card-body" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
            <div type="button" class="btn btn-outline-danger" @click="deleteToken(workflowState.token)">
                Delete token
            </div>

        </div>
        <div class="card-body" v-if="workflowState.error_on_request">
            <div class="alert alert-info">
                This token is not correct, please enter another token
            </div>
        </div>
</div></template>

<style scoped></style>
