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
                    //generateChart();
                    //generateBoxPlotByKey('memory', 'memory_canvas', true, 'MiB', 'Requested memory in', 'Requested memory');
                    //generateBoxPlotByKey('vmem', 'vmem_canvas', true, 'MiB', 'Virtual memory in', 'Virtual memory');
                    //generateBoxPlotByKey('rss', 'rss_canvas', true, 'MiB', 'Physical memory in', 'Physical memory');
                    genereateBoxPlotMultiByKeys(['memory', 'vmem', 'rss'], 'multiple_canvas', true, 'MiB', ['Requested memory in ', 'Virtual memory in', 'Physical memory in '], 'Memory');
                    generateDurationSumChart();
                    //addRamAllocationPercentageToGraph();
                    /*
                    - add IO read write graph
                    - add CPU raw usage and % allocated graph
                    */
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

function generateDurationData(): any[] {
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


function getDataInValidFormat(byte_numbers: number[], wantedType: string): [number[], string] {
    const types: string[] = ['b', 'kiB', 'MiB', 'GiB'];
    let iteration: number = 0;
    
    if (byte_numbers.length > 0) {
        while(byte_numbers.some(elm => elm > 10000) && iteration < types.length - 1 && types[iteration] !== wantedType) {
            byte_numbers = byte_numbers.map((num): number => num / 1024);
            iteration++;
        }        
    }
    return [byte_numbers, types[iteration]]
    
}

function generateSummarizedDataByKey(key: string, factorizer: number = 1): any {
    let data_pair: any = {};
    data_pair["labels"] = [];
    data_pair["data"] = [];
    let states: any = toRaw(workflowState.process_state);
    for (let process in states) {
        data_pair["labels"].push(process);
        let tasks: any = states[process]['tasks'];
        let values: number[] = [];
        for (let task_id in tasks) {
            values.push(tasks[task_id][key]);
        }
        if (factorizer !== 1) {
            values = values.map((elem) => elem / factorizer);
        }
        data_pair["data"].push(values.reduce((a, b) => a + b, 0));
    }
    
    return data_pair;
}


function generateDataByKey(key: string, adjustFormat: boolean, wantedFormat: string): any {
    let data_pair: any = {};
    data_pair["labels"] = [];
    data_pair["data"] = [];
    data_pair['type'] = wantedFormat;
    let states: any = toRaw(workflowState.process_state);
    for (let process in states) {
        data_pair["labels"].push(process);
        let tasks: any = states[process]['tasks'];
        let values: number[] = [];
        for (let task_id in tasks) {
            values.push(tasks[task_id][key]);
        }
        if (adjustFormat) {
            data_pair["data"].push(getDataInValidFormat(values, wantedFormat)[0]);
        } else {
            data_pair["data"].push(values);
        }
        values = [values.reduce((a, b) => a + b, 0)];
        data_pair["data"].push(values);

    }
    
    return data_pair;

}

function generateDataByMultipleKeys(keys: string[], adjust: boolean, wantedFormat: string): any {
    let datasets: any[] = [];
    let labels: string[] = [];
    let states: any = toRaw(workflowState.process_state);
    let first_loop: boolean = true;
    for (let key of keys) {
        let single_dataset: any = {'label': key, data: []};
        for(let process in states) {
            let values: any[] = []
            if (first_loop) {
                labels.push(process)
            }
            let tasks: any = states[process]['tasks'];
            for (let task_id in tasks) {
                values.push(tasks[task_id][key]);
            }
            if (adjust) {
                single_dataset['data'].push(getDataInValidFormat(values, wantedFormat)[0]);
            } else {
                single_dataset['data'].push(values);
            }
        }
        datasets.push(single_dataset);
        first_loop = false;
    }
    return [labels, datasets];
}


 


// how to combine the metrics from currentState and process state - what about meta? 
// more data from api needed - otherwise no possibility to show all relevant metrics
// check chart.js and available visualizations in nf-tower


async function generateChart() {
    // needs a lot of future adjustments
    let datax = generateDurationData();
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

/**
 * geht bestimmt noch einfacher - async? warum immer warten bis das ganze fertig ist...
 */
function generateDiv(elementId: string, title: string): HTMLCanvasElement{
    const divWithCanvas = document.createElement('div');
    const titleElement = document.createElement('h5');
    titleElement.textContent = title;
    divWithCanvas.style.width = '75rem';
    const canvas = document.createElement('canvas');
    canvas.id = elementId;
    divWithCanvas.appendChild(titleElement);
    divWithCanvas.appendChild(canvas);
    const targetDiv = document.getElementById('canvas_area');
    targetDiv.appendChild(divWithCanvas);
    return canvas;
}

/**
 * openai: chatgpt - prompt: in javascript, take a list of strings, which can be splitted using the character ':'.
how to write a function, which returns the suffixes of those strings, where the prefix of the word is removed, which is the same for all strings in the list
result: 
*/
function getSuffixes(strings: string[]) {
  if (strings.length === 0) {
    return [];
  }

  const parts = strings[0].split(':');
  const commonPrefix = parts.slice(0, -1).join(':');
  
  // Remove common prefix from each string
  const suffixes = strings.map(string => {
    if (string.startsWith(commonPrefix)) {
      return string.substring(commonPrefix.length + 1);
    }
    return string;
  });

  return suffixes;
}


async function genereateBoxPlotMultiByKeys(keys: string[], canvasID: string, adjust: boolean, format: string, label: string[], title: string) {
    let generatedDatasets: [string[], any[]] = generateDataByMultipleKeys(keys, adjust, format);
    await delay(300);
    let canvas = generateDiv(canvasID, title);
    new Chart(
        canvas,
        {
            type: 'boxplot',
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                    },
                    tooltip: {
                        enabled: true
                    }
                }
            },
            data: {
                labels: getSuffixes(generatedDatasets[0]),
                datasets: generatedDatasets[1],
            }
        }
    );
}



async function generateDurationSumChart() {
    let data = generateSummarizedDataByKey('duration', 1000);
    await delay(300);
    let canvas = generateDiv('duration_sum_canvas', 'Duration by process');

    new Chart(
        canvas,
        {
            type: 'bar',
            options: {
                responsive: true,
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
                
                labels: getSuffixes(data["labels"]),
                datasets: 
                    [
                        {
                        label: `Summarized Duration in seconds`,
                        //data: data["data"],
                        data: data["data"],
                    }   
                ],
                
                
            },
            
        }
    );

}

async function generateBoxPlotByKey(key: string, canvasID: string, adjust: boolean, format: string, label: string, title: string) {
    // adjust here - get the data in the function to display ranges and so on.
    let data = generateDataByKey(key, adjust, format);
    await delay(300);

    let canvas = generateDiv(canvasID, title);
    


    new Chart(
        canvas,
        {
            type: 'boxplot',
            options: {
                responsive: true,
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
                
                labels: getSuffixes(data["labels"]),
                datasets: 
                    [
                        {
                        label: `${label} ${data['type']}`,
                        //data: data["data"],
                        data: data["data"],
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
            <div style="width: 75rem;"><canvas id="chartarea"></canvas></div>
        </div>
        <hr>
        <div class="card-body" id="canvas_area">

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
