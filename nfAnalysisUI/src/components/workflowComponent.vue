<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, toRaw } from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js";
import { useRouter, useRoute } from "vue-router";
import axios, { all, AxiosResponse} from "axios";
import { Chart, LinearScale, CategoryScale, TimeScale } from 'chart.js/auto'; 
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import ToggleButton from 'primevue/togglebutton';
import Tag from 'primevue/tag';
import MultiSelect from "primevue/multiselect";
import { FilterMatchMode, FilterService } from 'primevue/api';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import Process from "../models/Process"
import RadioButton from 'primevue/radiobutton';
import ScrollTop from 'primevue/scrolltop';
import Sidebar from 'primevue/sidebar';
import Menubar from 'primevue/menubar';
import Slider from 'primevue/slider';
import InputNumber from "primevue/inputnumber";
import Fieldset from "primevue/fieldset";
import Chip from 'primevue/chip';
import Tooltip from 'primevue/tooltip';
import { PointWithErrorBar, ScatterWithErrorBarsController } from 'chartjs-chart-error-bars';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import svgImage from "@/assets/traceflow.svg"
import progressComponentVue from "./progressComponent.vue";


/**
 * check how to have nested-ifs
 */



Chart.register(
  BoxPlotController,
  BoxAndWiskers,
  LinearScale,
  CategoryScale,
  ScatterWithErrorBarsController,
  PointWithErrorBar,
  zoomPlugin,
  annotationPlugin,
);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const router = useRouter();
const route = useRoute();

const confirm = useConfirm();
const toast = useToast();

/** Dialog functions **/

function confirmDeletion(): void {
  confirm.require({
    message: `Do you want to delete the token ${workflowState.token}? This will also delete all data connected to this token!`,
    header: 'Delete confirmation',
    acceptClass: 'p-button-danger',
    accept: () => {
      deleteToken();
    },
    reject: () => {
      toast.add({ severity: 'warn', summary: 'Aborted', detail: 'You have aborted the deletion of the token.', life: 5000 });
    },
  });
}


/** end of dialog functions **/

/** filter Service **/


const props = defineProps<{
  token: string;
}>();

const STATUSES = ['SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABORTED'];
const NON_AUTO_UPDATE_STATES = ["ABORTED", "COMPLETED", "FAILED"];

const STORAGE_UNITS = ['b', 'kiB', 'MiB', 'GiB'];
const TIME_UNITS = ['s', 'min', 'h'];

const FAST_INTERVAL: number = 15000;
const SLOW_INTERVAL: number = 25000;
const filters = ref({
  'status': { value: null, matchMode: FilterMatchMode.IN },
  'name': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'process': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'tag': { value: null, matchMode: 'tagTableFilter', },
});

const rowClass = (data: any) => {
  return [{ 'analysis-alert-row': processIsDeclaredProblematic(data) }];
};

function isProblematic(data: any): boolean {
  data = toRaw(data);
  return processIsDeclaredProblematic(data);
}

function cpuAllocationSort(a) {

  if (a["cpu_percentage"] && a["cpus"] && a["cpus"] > 0) {
    return a["cpu_percentage"] / a["cpus"];
  }
  return 0;

}

function memoryAllocationSort(a){
  if (a["rss"] && a["memory"]  && a["memory"] > 0 ) {
    return a["rss"] / a["memory"]
  }
  return 0;
}

function processIsDeclaredProblematic(data: any): boolean {
  let penalized: boolean = false;
  if (workflowState.selectedRun !== '' && workflowState.selectedRun !== undefined) {
    if (workflowState.fullAnalysis && workflowState.fullAnalysis['workflow_scores'] && workflowState.fullAnalysis['workflow_scores']['task_information'] && workflowState.fullAnalysis['workflow_scores']['task_information'][workflowState.selectedRun]){
      let task_informations: any[] = toRaw(workflowState.fullAnalysis['workflow_scores']['task_information'][workflowState.selectedRun]);
      const task_info = task_informations.find((task: any) => {
        return task.task_id == data.task_id && task.run_name == data.run_name;
      });
      if (task_info !== null && task_info !== undefined) {
        if (task_info.raw_cpu_penalty) {
          penalized = task_info.raw_cpu_penalty > (requestState.request_params['valid_cpu_allocation_deviation'] / 100).toFixed(2);
        }
        if (task_info.raw_memory_penalty) {
          penalized = penalized || task_info.raw_memory_penalty > (requestState.request_params['valid_memory_allocation_deviation'] / 100).toFixed(2);
        }
      } 
    }
  } 
  return penalized
}

/** end of filterService **/


const uiState = reactive<{
  sidebarVisible: boolean;
  menuItems: any[];
}>({
  sidebarVisible: false,
  menuItems: [
    {
      label: 'Open Sidebar',
      icon: 'pi pi-arrow-right',
      command: changeSidebarState,
    },
    {
      label: 'Quit',
      icon: 'pi pi-fw pi-power-off',
      command: goBackToMain,
    },
  ]

});


const requestState = reactive<{
  request_params: any
}>({
  request_params: {
    'valid_cpu_allocation_deviation': 25,
    'valid_memory_allocation_deviation': 25,
    'cpu_ram_slide': 50,
    'cpu_weight': 0.5,
    'ram_weight': 0.5,
  },
});




const analysisInfo = reactive<{
  cpuRamRatioText: string;
}>({
  cpuRamRatioText: 'Select a process in the plot to get more information',
});

const workflowState = reactive<{
  currentState: any;
  progress: any;
  runningProcesses: any;
  filteredRunningProcesses: any;
  processObjects: Process[];
  tagAnalysis: any;
  fullAnalysis: any;
  tablePageData: any;
  runStartMapping: any;
  selectedRun: string;
  failedProcesses: boolean;
  pollIntervalId: any;
  pollIntervalValue: number;
  loading: boolean;
  token: string;
  token_info_requested: boolean;
  error_on_request: boolean;
  filteredProgressProcesses: any;
  selectedProcesses: string[];
  meta: any;
  //connection: WebSocket;
}>({
  currentState: {},
  progress: {
    "all": null,
    "submitted": null,
    "running": null,
    "failed": null,
    "completed": null,
    "cached": null,
    "pending": null
  },
  runningProcesses: {},
  filteredRunningProcesses: {},
  processObjects: [],
  tagAnalysis: {},
  fullAnalysis: {},
  tablePageData: [],
  runStartMapping: {},
  selectedRun: '',
  failedProcesses: false,
  pollIntervalId: null,
  pollIntervalValue: 0,
  loading: true,
  token: "",
  token_info_requested: false,
  error_on_request: false,
  filteredProgressProcesses: {},
  selectedProcesses: [],
  meta: {},
  //connection: null,
});

const metricCharts = reactive<{
  chartsGenerated: boolean;
  durationFormat: string; // ['s', 'min', 'h']
  memoryFormat: string; 
  memoryChart: any | null;
  memoryCanvas: any | null;
  relativeMemoryChart: any | null;
  relativeMemoryCanvas: any | null;
  ioChart: any | null;
  ioCanvas: any | null;
  cpuChart: any | null;
  cpuCanvas: any | null;
  cpuRamRatioCanvas: any | null;
  cpuRamRatioChart: any | null;
  durationChart: any | null;
  durationCanvas: any | null;
  dynamicChart: any | null;
  dynamicCanvas: any | null;
}>({
  chartsGenerated: false,
  durationFormat: 'h',
  memoryFormat: 'GiB',
  memoryChart: null,
  memoryCanvas: null,
  relativeMemoryChart: null,
  relativeMemoryCanvas: null,
  ioChart: null,
  ioCanvas: null,
  cpuChart: null,
  cpuCanvas: null,
  cpuRamRatioCanvas: null,
  cpuRamRatioChart: null,
  durationChart: null,
  durationCanvas: null,
  dynamicChart: null,
  dynamicCanvas: null,
});

const filterState = reactive<{
  availableProcesses: string[];
  availableTags: string[];
  selectedMetricProcesses: string[];
  autoselectAllMetricProcesses: boolean;
  selectedProgressProcesses: string[];
  autoselectAllProgressProcesses: boolean;
  autoselectAllRunningProcesses: boolean;
  autoselectAllRunningTags: boolean;
  autoselectAllMetricTags: boolean;
  selectedTags: string[];
  selectedRunningTags: any[];
  selectedRunningProcesses: any[];
  processTaskMapping: any;
  expandedRows: any;
  tableLoading: boolean;
  tableDebounceTimer: ReturnType<typeof setTimeout> | null;
  tableFilter: string;
  debouncedSelections: any;
  totalTableRecords: number;

}>({

  availableProcesses: [],
  availableTags: [],
  selectedMetricProcesses: [],
  autoselectAllMetricProcesses: true,
  selectedProgressProcesses: [],
  autoselectAllProgressProcesses: true,
  autoselectAllRunningProcesses: true,
  autoselectAllRunningTags: true,
  autoselectAllMetricTags: true,
  selectedTags: [],
  selectedRunningTags: [],
  selectedRunningProcesses: [],
  processTaskMapping: {},
  expandedRows: [],
  tableLoading: false,
  tableDebounceTimer: null,
  tableFilter: JSON.stringify(null),
  debouncedSelections: {},
  totalTableRecords: 0,
});

/** functions on init and polling */

/**  TODO: as all the table data gets delivered by the table-endpoint, this data should not be transfered twice. result_by_run_name delivers all entries again
  --> need to check which information is needed at which part of the UI and what can be precomputed by the API
*/

function getDataInitial(token = props.token): void {
  if (token.length > 0) {
    workflowState.loading = true;
    axios.get(`${API_BASE_URL}run/info/${token}/`)
    .then(
      response => {
        if (response.data["error"]) {
          workflowState.processObjects = [];
          workflowState.error_on_request = true;
        } else {
          workflowState.meta = response.data["result_meta"];
          metricCharts.memoryFormat = 'GiB';
          metricCharts.durationFormat = 'h';
          updateRunStartMapping();
          setFirstRunName();
          workflowState.processObjects = {};
          workflowState.runningProcesses = updateRunningProcesses();
          updateFilterState();
          updateFilteredRunningProcesses();
          workflowState.token = token;
          requestAnalysisData();
          updateCurrentState();
          updateProgress();
          workflowState.token_info_requested = true;
          workflowState.error_on_request = false;
          progressProcessSelectionChanged();
          updateTablePageData();
          startPollingLoop();
          
        }
      },
    );
    // workflowState.connection = new WebSocket(`wss://localhost:8000/run/${token}`); possible websocket connection
  }

}


function requestAnalysisData(): void {
  axios.post(`${API_BASE_URL}run/analysis/${workflowState.token}/`,
    requestState.request_params,
    { responseType: 'json', 'decompress': true, headers: {
    "Content-Type": "application/json",
    "Content-Encoding": "gzip, deflate, br",
  },}
  ).then(response => {
    workflowState.fullAnalysis = response.data;

    if (metricCharts.chartsGenerated) {
      updatePlots();
    } else {
      createPlots();
      updatePlots();
    }
       
  });
  
}

function destroyPollTimer(): void {
  clearInterval(workflowState.pollIntervalId);

}

function startPollingLoop(): void {
  if (currentlyNonFinishedWorkflows()) {
    updateToFasterPolling();
  } else {
    updateToSlowerPolling();
  }
}

function dataPollingLoop(): void {
  axios.get(`${API_BASE_URL}run/info/${workflowState.token}/`,
  ).then(
    response => {
      if (response.data["error"]) {
        workflowState.error_on_request = true;

      } else {
        if (!metricCharts.chartsGenerated) {
          createPlots();
        }
        workflowState.meta = response.data["result_meta"];
        updateRunStartMapping();
        workflowState.processObjects = {}
        workflowState.runningProcesses = updateRunningProcesses();
        if (!NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
          updateFilterState();
          updateFilteredRunningProcesses();
        }
        updateCurrentState();
        updateProgress();
        updateTablePageDataByDebouncedFilter();
        requestAnalysisData();
        workflowState.error_on_request = false;
        progressProcessSelectionChanged();
        checkForPollingTimerAdjustment();
      }
    });
}

/** end of init and polling */

/**
 * filter state functions
 */

function updateTableFilter(event?: any): void {
  console.log("filter update called");
  if (event){

    filterState.tableFilter = JSON.stringify(event.filters);
    filterState.debouncedSelections = {
      page: event.page,
      rows: event.rows,
      sortField: event.sortField,
      sortOrder: event.sortOrder,
    }

    if (filterState.tableDebounceTimer !== null) {
      clearTimeout(filterState.tableDebounceTimer);
    }

    filterState.tableDebounceTimer = setTimeout(
      updateTablePageDataByDebouncedFilter, 2000);
  }
}  

// TODO: refactor - tablePageData in own state: all filters, all numbers, all data

function updateTablePageDataByDebouncedFilter(): void {
  let loadParams: any = { runName: workflowState.selectedRun, filters: filterState.tableFilter, ...toRaw(filterState.debouncedSelections)};
  filterState.tableLoading = true;
  axios.get(`${API_BASE_URL}run/table/${workflowState.token}`, {params: loadParams}
  ).then(
    (response: any) => {
      workflowState.tablePageData = response.data['table_page'];
      filterState.totalTableRecords = response.data['number_available'];
      filterState.tableLoading = false;
    }
  );
  
}



function updateTablePageData(event?: any): void {
  let loadParams: any = {runName: workflowState.selectedRun };
  if (event){
      loadParams.page = event.page;
      loadParams.rows = event.rows;
      loadParams.sortField = event.sortField;
      loadParams.sortOrder = event.sortOrder;
      loadParams.filteredRunningProcesses = JSON.stringify(event.filters)
  }
  filterState.tableLoading = true;
  axios.get(`${API_BASE_URL}run/table/${workflowState.token}`, {params: loadParams}
  ).then(
    (response: any) => {
    
      workflowState.tablePageData = response.data['table_page'];
      filterState.totalTableRecords = response.data['number_available'];
      filterState.tableLoading = false;
    }
  );
}


function updateFilterState(): void {
  updateAvailableProcessNamesForFilter();
  updateAvailableTags();
  updateIfAutoselectEnabled();
  updateIfTagAutoSelectEnabled();

}

function updateAvailableProcessNamesForFilter(): void {
  filterState.availableProcesses = getProcessNamesOnly();
}

function updateAvailableTags(): void {
  filterState.availableTags = getTags();
}

function getTagsFromString(tagString: string): any[] {
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

function getTags(): any[] {
  let tags: any[] = [];
  const task_states: Process[] = toRaw(workflowState.processObjects);
  if (task_states) {
    for (let task of task_states) {
      if (task.tag !== null) {
        let retrievedTags: any[] = task.tag;
        for (let pair of retrievedTags) {
          let tempKey: string = Object.keys(pair)[0];
          if (!tags.some(item => item[tempKey] === pair[tempKey])) {
            tags.push(pair);
          }
        }
      }
    }
  }

  return tags;
}

function checkTagMatch(tag: any, processTags: any): boolean {
  return processTags.some((item: any) => checkKeyValuePairing(item, tag));
}

function checkKeyValuePairing(item: any, tag: any): boolean {
  if (Object.keys(tag)[0] === Object.keys(item)[0]) {
    return tag[Object.keys(tag)[0]] === item[Object.keys(item)[0]];
  }
  return false;
}

function setSelectedMetricProcesses(processes: any[]): void {
  filterState.selectedMetricProcesses = processes;
}

function setSelectedMetricTags(tags: any[]): void {
  filterState.selectedTags = tags;
}

function setSelectedRunningTags(tags: any[]): void {
  filterState.selectedRunningTags = tags;
}

function setSelectedProgressProcesses(processes: any[]): void {
  filterState.selectedProgressProcesses = processes;
}

function setSelectedRunningProcesses(processes: any[]): void {
  filterState.selectedRunningProcesses = processes;
}

function selectAllMetricProcesses(): void {
  setSelectedMetricProcesses(filterState.availableProcesses);
  metricProcessSelectionChanged();
}

function selectAllRunningProcesses(): void {
  setSelectedRunningProcesses(filterState.availableProcesses);
  runningProcessSelectionChanged();
}

function unselectAllMetricProcesses(): void {
  setSelectedMetricProcesses([]);
  metricProcessSelectionChanged();
}

function unselectAllMetricTags(): void {
  setSelectedMetricTags([]);
  metricTagSelectionChanged();
}

function unselectAllRunningTags(): void {
  setSelectedRunningTags([]);
  runningTagSelectionChanged();
}

function selectAllMetricTags(): void {
  setSelectedMetricTags(filterState.availableTags);
  metricTagSelectionChanged();
}

function selectAllRunningTags(): void {
  setSelectedRunningTags(filterState.availableTags);
  runningTagSelectionChanged();
}

function selectAllProgressProcesses(): void {
  setSelectedProgressProcesses(filterState.availableProcesses);
  progressProcessSelectionChanged();
}

function unselectAllProgressProcesses(): void {
  setSelectedProgressProcesses([]);
  progressProcessSelectionChanged();
}

function unselectAllRunningProcesses(): void {
  setSelectedRunningProcesses([]);
  runningProcessSelectionChanged();
}

function updateIfTagAutoSelectEnabled(): void {
  if (filterState.autoselectAllMetricTags) {
    selectAllMetricTags();
  } if (filterState.autoselectAllRunningTags) {
    selectAllRunningTags();
  }  /*if (filterState.autoselectAllProgressTags) {
    selectAllProgressTags(); TODO: IMPLEMENT
  } */
}

function updateIfAutoselectEnabled(): void {
  if (filterState.autoselectAllProgressProcesses) {
    selectAllProgressProcesses();
  }
  if (filterState.autoselectAllMetricProcesses) {
    selectAllMetricProcesses();
  }
  if (filterState.autoselectAllRunningProcesses) {
    selectAllRunningProcesses();
  }
}

function updateFilteredProgressProcesses(all: boolean = false): void {
  let filtered: any = {};
  if (all) {
    filterState.selectedProgressProcesses = toRaw(filterState.availableProcesses);
  }
  if (workflowState.processObjects) {
    for (let process of workflowState.processObjects) {
      if (filterState.selectedProgressProcesses.some(obj => obj['name'] === process.process)) {
        filtered[process.process] = process;
      }
    }
  }

  workflowState.filteredProgressProcesses = filtered;
}

function updateFilteredRunningProcesses(all: boolean = false): void {
  let filtered: any = {};
  if (all) {
    filterState.selectedRunningProcesses = toRaw(filterState.availableProcesses);
   
  }
  let tagFilter: boolean = false;
  let selectedTags: any = null;
  if (filterState.selectedRunningTags.length > 0 && filterState.selectedRunningTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedRunningTags);
  }
  
  let runningProcesses = toRaw(workflowState.runningProcesses);
  if (Object.keys(runningProcesses).length > 0 ) {
    for (let [name, processes] of Object.entries(runningProcesses)) {
      if (filterState.selectedRunningProcesses.some(obj => obj['name'] === name)) {
        for (let process of processes) {
          if (tagFilter) {
            if (!selectedTags.some(tag => checkTagMatch(tag, process["tag"]))) {
              continue;
            }
          }
          if (!(name in filtered)){
            filtered[name] = [];
          }
          filtered[name].push(process);
        }
      }
    }  
  }

  workflowState.filteredRunningProcesses = filtered;
}


function progressProcessSelectionChanged(): void {
  updateFilteredProgressProcesses();
}

function runningProcessSelectionChanged(): void {
  updateFilteredRunningProcesses();
}


function metricProcessSelectionChanged(): void {
  if (filterState.selectedMetricProcesses.length > 0 && metricCharts.chartsGenerated) {
    updatePlots();
  }
}

function metricTagSelectionChanged(): void {
  if (filterState.selectedMetricProcesses.length > 0 && metricCharts.chartsGenerated) {
    updatePlots();
  }
}

function runningTagSelectionChanged(): void{
  updateFilteredRunningProcesses();
}


function metricProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllMetricProcesses && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllMetricProcesses();
  } else {
    // what to do here?
  }
}

function metricTagAutoSelectionChanged(): void {
  if (filterState.autoselectAllMetricTags && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllMetricTags();
  }
}

function runningTagAutoSelectionChanged(): void {
  if (filterState.autoselectAllRunningTags && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllRunningTags();
  }
}


function runningProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllRunningProcesses && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    updateFilteredRunningProcesses(true);
  }
}

function progressProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllProgressProcesses && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    updateFilteredProgressProcesses(true);
  } else {
    // what to do here?
  }
}

function hideAutoUpdateEnableOptionMetric(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllMetricProcesses;
}

function hideAutoUpdateEnableOptionRunning(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllRunningProcesses;
}

function hideAutoUpdateEnableOptionRunningTags(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllRunningTags;
}

function hideAutoUpdateEnableOptionProgress(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllProgressProcesses;
}

function hideAutoUpdateEnableOptionTags(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllMetricTags;
}


/** end of filter state functions */

/** Plot creation **/

function createPlots() {
  createRamPlot();
  createRelativeRamPlot();
  createCPUPlot();
  createIOPlot();
  createDurationPlot();
  createCPURamRatioPlot();
  metricCharts.chartsGenerated = true;
 
}

/* TODO: REFACTOR regarding asynchron
*/
function getCanvasDiv(elementId: string): HTMLCanvasElement {
  const canvasElement = document.getElementById(elementId);
  return canvasElement;

}

async function createRelativeRamPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('relative_ram_canvas');
  metricCharts.relativeMemoryCanvas = canvas;
  const relativeRamChart = new Chart(
    metricCharts.relativeMemoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Memory usage in % (physical memory to requested memory)',
            }
          }
        },
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(relativeRamChart);
  metricCharts.relativeMemoryChart = relativeRamChart;


}

async function createIOPlot() {

  const canvas: HTMLCanvasElement = getCanvasDiv('io_canvas')
  metricCharts.ioCanvas = canvas;

  const ioChart = new Chart(
    metricCharts.ioCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'amount of read and written data in GiB',
            }
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(ioChart);
  metricCharts.ioChart = ioChart;

}

async function createDurationPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('duration_canvas');
  metricCharts.durationCanvas = canvas;
  const durationChart = new Chart(
    metricCharts.durationCanvas,
    {
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: `Duration in ${metricCharts.durationFormat}`
            }
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(durationChart);
  metricCharts.durationChart = durationChart;
}

async function createRamPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('ram_canvas');
  metricCharts.memoryCanvas = canvas;

  const memoryChart = new Chart(
    metricCharts.memoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: `RAM value in ${metricCharts.memoryFormat}`
            },
          },
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(memoryChart);
  metricCharts.memoryChart = memoryChart;


}

async function createCPUPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_canvas');
  metricCharts.cpuCanvas = canvas;
  const cpuChart = new Chart(
    metricCharts.cpuCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'CPU value in %'
            },
          },
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(cpuChart);
  metricCharts.cpuChart = cpuChart;


}


async function createCPURamRatioPlot() {
  
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_ram_ratio');
  metricCharts.cpuRamRatioCanvas = canvas;
  const cpuRamRatioChart = new Chart(
    metricCharts.cpuRamRatioCanvas,
    {
      type: 'scatterWithErrorBars',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          annotation: {
            annotations: {
              box_valid: {
                type: 'box',
                xMin: 80,
                xMax: 100,
                yMin: 80,
                yMax: 100,
                backgroundColor: 'rgba(38, 131, 17, 0.22)',
                borderWidth: 0,
              },

            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'CPU allocation in %',
            },
            min: 0,
            ticks: {
              callback: function (value, index, ticks) {
                return value + ' %'
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'RAM usage in % (used related to requested)',
            },
            min: 0,
            ticks: {
              // Include a dollar sign in the ticks
              callback: function (value, index, ticks) {
                return value + ' %'
              }
            }
          }
        },
        
        // These seems to be a bug, the name of the clicked prozess remains "undefined"

        onClick: function (event, datapoints) {
          if (datapoints.length > 0) {
            let element = datapoints[0];
            let index = element.index;
            let clickedProcess: string = metricCharts.cpuRamRatioChart.data.labels[index];
            adjustTextForRatioMessage(clickedProcess, index);
          }
        },
        onHover: function (event, datapoints) {
          if (datapoints.length > 0) {
            event.native.target.style.cursor = 'pointer';
          } else {
            event.native.target.style.cursor = 'default';
          }
        },

      },
      data: {
        labels: [],
        datasets: [],
      }

    }
  )
  Object.seal(cpuRamRatioChart);
  metricCharts.cpuRamRatioChart = cpuRamRatioChart;
  
  updateCPURamRatioChart();
}

/** End of Plot creation */

/** Plot updating **/

function updatePlotsConditional(event: any) {
  if (metricCharts.chartsGenerated) 
  {
    updatePlots();
  }
}

/** TODO: check why the get triggerred multiple times, we actually dont want all the request to be sent multiple times */

function updatePlots() {
  if (currentlySelectedWorkflowHasPlottableData()) {

    updatePlotsByRequest();
  }

}

metricCharts.durationCanvas,
    {
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: `Duration in ${metricCharts.durationFormat}`
            }
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }

async function updatePlotsByRequest(): Promise<void> {

  const processNamesToFilterBy: string = JSON.stringify([...new Set(toRaw(filterState.selectedMetricProcesses).map((proc: any) => proc['name']))]);
  const tagsToFilterBy: string = JSON.stringify([...new Set(toRaw(filterState.selectedTags).map((tag: any) => unfoldTag(tag)))]);
  

  await axios.get(
    `${API_BASE_URL}run/plots/${workflowState.token}`, 
    { params: 
      { processFilter: processNamesToFilterBy, 
        tagFilter: tagsToFilterBy, 
        runName: JSON.stringify(workflowState.selectedRun),
        memoryFormat: metricCharts.memoryFormat,
        durationFormat: metricCharts.durationFormat,
      }
    }
  ).then(
      (response: any) => {
        let relative_ram_data: any = response.data['relative_ram'];
        let cpu_data: any = response.data['cpu'];
        let io_data: any = response.data['io'];
        let ram_data: any = response.data['ram'];
        let duration_data: any = response.data['duration'];
      
        
        let relative_datasets: any = { 'label': 'Memory usage in %', 'data': [], 'maxBarThickness': 30 };

        let datasets: any[] = [];
        relative_datasets['data'] = Object.values(relative_ram_data[1]);
        datasets.push(relative_datasets);
        let relative_ram_plot_data: any = [relative_ram_data[0], datasets];

        metricCharts.relativeMemoryChart.data.labels = getSuffixes(relative_ram_plot_data[0]);
        metricCharts.relativeMemoryChart.data.datasets = relative_ram_plot_data[1];
        metricCharts.relativeMemoryChart.update('none');

        datasets = [];
        let cpu_allocation_dataset: any = {'label' : 'CPU allocation in %', 'data': [], 'maxBarThickness': 30}; 
        cpu_allocation_dataset['data'] = Object.values(cpu_data[1][0]);

        datasets.push(cpu_allocation_dataset);
        let cpu_raw_dataset: any = { 'label': 'Raw CPU usage in %', 'data': [], 'maxBarThickness': 30 };
        cpu_raw_dataset['data'] = Object.values(cpu_data[1][1]);
        datasets.push(cpu_raw_dataset);
        let cpu_plot_data: any = [cpu_data[0], datasets]; // can refactor this for all, is not necessary??

        metricCharts.cpuChart.data.labels = getSuffixes(cpu_plot_data[0]);
        metricCharts.cpuChart.data.datasets = cpu_plot_data[1];
        metricCharts.cpuChart.update('none'); 

        let io_read_dataset: any = { 'label': 'Read', 'data': [], 'maxBarThickness': 30};
        let io_write_dataset: any = { 'label': 'Write',  'data': [], 'maxBarThickness': 30};

        datasets = [];
        io_read_dataset['data'] = Object.values(io_data[1][0]);
        io_write_dataset['data'] = Object.values(io_data[1][1]);
        datasets.push(io_read_dataset);
        datasets.push(io_write_dataset);

        let io_plot_data: any = [io_data[0], datasets];
        

        metricCharts.ioChart.data.labels = getSuffixes(io_plot_data[0]);
        metricCharts.ioChart.data.datasets = io_plot_data[1];
        metricCharts.ioChart.options.scales.y.title.text = `I/O values in ${metricCharts.memoryFormat}`;
        metricCharts.ioChart.update('none');

        datasets = [];
        let ram_requested_dataset: any = {'label': 'Requested memory', 'data': [], 'maxBarThickness': 30};
        let ram_vmem_dataset: any = {'label': 'Virtual memory', 'data': [], 'maxBarThickness': 30};
        let ram_rss_dataset: any = {'label': 'Physical memory', 'data': [], 'maxBarThickness': 30};
        
        ram_requested_dataset['data'] = Object.values(ram_data[1][0]);
        ram_vmem_dataset['data'] = Object.values(ram_data[1][1]);
        ram_rss_dataset['data'] = Object.values(ram_data[1][2]);
        datasets.push(ram_requested_dataset)
        datasets.push(ram_vmem_dataset)
        datasets.push(ram_rss_dataset)

        let ram_plot_data: any = [ram_data[0], datasets]

        metricCharts.memoryChart.data.labels = getSuffixes(ram_plot_data[0]);
        metricCharts.memoryChart.data.datasets = ram_plot_data[1];
        metricCharts.memoryChart.options.scales.y.title.text = `Memory values in ${metricCharts.memoryFormat}`;
        metricCharts.memoryChart.update('none')

        datasets = []
        let duration_single_dataset: any = {'type': 'boxplot', 'label': 'Execution in realtime', 'data': [], 'maxBarThickness': 30};
        let duration_sum_dataset: any = {'type': 'bar', 'label': 'Realtime summerized', 'data': [], 'maxBarThickness': 30};
        
        duration_single_dataset['data'] = Object.values(duration_data[1][0]);
        duration_sum_dataset['data'] = Object.values(duration_data[1][1]);
        datasets.push(duration_single_dataset);
        datasets.push(duration_sum_dataset);

        let duration_plot_data: any = [duration_data[0], datasets]
        metricCharts.durationChart.data.labels = getSuffixes(duration_plot_data[0]);
        metricCharts.durationChart.data.datasets = duration_plot_data[1];
        metricCharts.durationChart.options.scales.y.title.text = `Duration values in ${metricCharts.durationFormat}`;
        metricCharts.durationChart.update('none');



        /** TODO: extend with remaining plots: duration */
      }
    ).catch(error => {
      console.log("This crashed");
      console.log(error);
    });
}




function updateCPURamRatioChart() {
  let rawedFullAnalysis: any = toRaw(workflowState.fullAnalysis);
  if (rawedFullAnalysis && rawedFullAnalysis['cpu_ram_relation_data'][workflowState.selectedRun]) {
    metricCharts.cpuRamRatioChart.data.labels = getSuffixes(rawedFullAnalysis['cpu_ram_relation_data'][workflowState.selectedRun]['labels']);
    metricCharts.cpuRamRatioChart.data.datasets = [rawedFullAnalysis['cpu_ram_relation_data'][workflowState.selectedRun]['data']];
    metricCharts.cpuRamRatioChart.update('none');
  }
  

}



/** keep just in case 
async function updateRelativeRamPlot() {
  let generatedDatasets: [string[], any[]] = await getMemoryRelativeData();
  console.log(generatedDatasets);
  metricCharts.relativeMemoryChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.relativeMemoryChart.data.datasets = generatedDatasets[1];
  metricCharts.relativeMemoryChart.update('none');
}

*/

/** end of plot updating */


/** helper functions */

function recalculateWeights() {
  requestState.request_params['cpu_weight'] = (1 - (requestState.request_params['cpu_ram_slide'] / 100).toFixed(2)).toFixed(2);
  requestState.request_params['ram_weight'] = (1 - requestState.request_params['cpu_weight']).toFixed(2);
}

/**
 *  only returns the keys
*/
function sortByScore(scores: any) {
  return Object.keys(scores).sort((run_a, run_b) => {
    if (scores[run_a] !== null && scores[run_b] !== null) {
      if (scores[run_a]["full_run_score"] !== null) {
      if (scores[run_b]["full_run_score"] !== null) {
        return scores[run_a]["full_run_score"] - scores[run_b]["full_run_score"];
      } else {
        return 1;
      }
    } else {
      if (scores[run_b]["full_run_score"] !== null) {
        return -1;
      } else {
        return 0
      }
    }
  } else {
    return 0;
  }
    

  });

}


function checkIfProblemsFound() {
  if (workflowState.selectedRun !== '') {
    if (workflowState.fullAnalysis && workflowState.fullAnalysis['workflow_scores'] && workflowState.fullAnalysis['workflow_scores']['process_scores'][workflowState.selectedRun]){
      let scores: any[] = toRaw(workflowState.fullAnalysis['workflow_scores']['process_scores'][workflowState.selectedRun]);
      return scores.some((process: any) => process["problems"].length > 0);
    }
  } else {
    return false;
  }
}



function adjustTextForRatioMessage(clickedProcess: string, idx: number) {

  let analysisData: any[] = toRaw(workflowState.fullAnalysis["cpu_ram_relation_data"][workflowState.selectedRun]["data"]["data"]);
  let elem = analysisData[idx];

  let cpu_data: any[] = [elem["xMin"], elem["x"], elem["xMax"]];
  let memory_data: any[] = [elem["yMin"], elem["y"], elem["yMax"]];



  let concatString = `The process ${clickedProcess} has the following characteristics: \n`
    + `The CPU allocation varies from ${cpu_data[0].toFixed(2)} % to ${cpu_data[2].toFixed(2)} % with an average of ${cpu_data[1].toFixed(2)} %.\n`
    + `The used memory percentage varies from ${memory_data[0].toFixed(2)} % to ${memory_data[2].toFixed(2)}  with an average of ${memory_data[1].toFixed(2)} %.\n`;

  analysisInfo.cpuRamRatioText = concatString;

}

function showProblem(problem: any): string {
  if (problem["cpu"]){ //cpu
    if (problem["cpu"] === "more") { // more
      if (problem["restriction"] === null) {
        return `Currently this process has ${problem["requested"].toFixed(2)} CPUs assigned in average, but needs ${problem["solution"]["cpus"].toFixed(2)} CPUs in average. It may be useful to increase the number of CPUs assigned to certain tasks of this process.. Please consider that the number of CPUs needed for this process may vary from task to task. Consider to set this value dynamically.`;
      } else if (problem["restriction"] === "max_reached") {
        return `The maximum number of CPUs you have assigned over all tasks is ${problem["solution"]["available"]} CPUs - to meet the requirements of the process, ${problem["solution"]["needed"].toFixed(2)} CPUs should be assigned tasks of this process. If there are no more CPU resources available in your current setup, you must increase the available CPU resources or adjust the implementation of the process.`;
      } else if (problem["restriction"] === "max_reached_unsure") {
        return `Currently this process has ${problem["requested"].toFixed(2)} CPUs assigned in average, but needs ${problem["solution"]["cpus"].toFixed(2)} CPUs in average. It may be useful to increase the number of CPUs assigned to certain tasks of this process. Please consider that the number of CPUs needed for this process may vary from task to task. Consider to set this value dynamically. Unfortunately, it is not clear from the data whether they have already fully exhausted the CPU resources on your machine.`;
      }
    } else { // less
      if (problem["restriction"] === null) {
        return `The process has a low CPU allocation in average. This means that fewer CPUs are needed than are assigned to the process. Only ${problem["solution"]["cpus"].toFixed(2)} CPUs are required in average, while ${problem["requested"].toFixed(2)} are assigned in average. It is a good idea to assign the number of allocated CPU cores for a task more dynamically. If the CPU allocation for certain processed data is lower, a lower value can be assigned here. Please bear in mind that the specified average is not necessarily suitable as a value for all tasks of the process.  If the process is one that can be split and where the load on the CPU varies greatly during execution, it may be a good idea to split the process.`;
      } else {
        if (problem["restriction"] === "min_reached") {
          return `Only one CPU is assigned to this process and it is not fully used in average. If the process is one that can be split and where the load on the CPU varies greatly during execution, it may be a good idea to split the process.`;
        }
      }
    }
  } else if (problem["ram"]) { // memory
      if (problem["ram"] === "less") {
        return `The process requires less RAM than specified and uses only ${reasonableDataFormat(problem['solution']['ram'])} of physical RAM in average, while ${reasonableDataFormat(problem['requested'])} are assigned in average. Consider adjusting the allocated RAM resources according to the data being processed, if possible.`;
      } else if (problem["ram"] === "more") {
        if (problem["restriction"] === null){
          return `The process requires more RAM, as was assigned to it. It uses ${reasonableDataFormat(problem['solution']['ram'])} in average, while only ${reasonableDataFormat(problem['requested'])} are assigned in average. There seem to be cases where the process consumes more RAM resources than have been assigned to it. This can lead to bottlenecks and process failures. If possible, adjust the allocated resources for tasks that are expected to use more memory.`;
        } else if (problem["restriction"] === "max_reached" ){
          return `The proces requires more RAM, as was assigned to it. It uses ${reasonableDataFormat(problem['solution']['ram'])} in average, while only ${reasonableDataFormat(problem['requested'])} are assigned in average. As the used RAM of the task is higher, than the maximum value you have assigned to any processes (${reasonableDataFormat(problem["solution"]["available"])}), you need to check if you have enough RAM resources or if you need to increase them.`;
        } else if (problem["restriction"] === "max_reached_unsure") {
          return `The proces requires more RAM, as was assigned to it. It uses ${reasonableDataFormat(problem['solution']['ram'])} in average, while only ${reasonableDataFormat(problem['requested'])} are assigned in average. The used RAM of the task may be higher, than the maximum value of available RAM on your machine. Unfortunately, it is not clear from the data whether you have already fully exhausted the RAM resources on your machine. Please check, if you have enough RAM resources or if you need to increase them.`;
        }
      }

  }
  return "Sorry, the data could not be processed. The tool is not able to show the problem.";
}



function currentlySelectedWorkflowHasPlottableData(): boolean {
  if (workflowState.selectedRun !== '') {
    return workflowState.currentState[workflowState.selectedRun] !== null;
  }
  return false;

}

function formattedDate(date: Date): string {
  const options: any = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return new Intl.DateTimeFormat('de-DE', options).format(date);
}

function adjustSelectedRun(): void {
  workflowState.processObjects = {}
  updateFilterState();
  updateFilteredProgressProcesses();
  updateCurrentState();
  updateProgress();
  if (!metricCharts.chartsGenerated) {
    createPlots();
  }
  
  updateTablePageData();
  // TODO: FIX: Problems with table and component.emitsOptions error  
}


function createProcessObjectsByRun(data: any): any {
  data = toRaw(data);
  let grouped: any = {};
  for (let key in data) {
    grouped[key] = [];
    for (let process of data[key]) {
      grouped[key].push(new Process(process));
    }
  }
  return grouped;
}

function setFirstRunName(): void {
  // refactor
}

function updateRunStartMapping(): void {
  let result: any = {};
  let hasRunning: boolean = false;
  const metaObjects: any = toRaw(workflowState.meta);
  if (Object.keys(metaObjects).length > 0) {
    for (let meta of metaObjects) {
      if (meta["event"] === "started") {
        result[meta["run_name"]] = new Date(meta["timestamp"]);
        hasRunning = true;
        if ([undefined, "WAITING"].includes(workflowState.currentState[meta["run_name"]])) {
          workflowState.currentState[meta["run_name"]] = "SUBMITTED";
          updateToFasterPolling();
        }
      }
    }
  }
  workflowState.runStartMapping = result;
  if ((workflowState.selectedRun === '' || workflowState.selectedRun === null) && hasRunning) {
    setFirstRunName();
  }


}

function changeSidebarState(value: boolean = true): void {
  uiState.sidebarVisible = value;
}

function goBackToMain(): void {
  router.push("/");
}

function startBackToMainTimer(): void {
  destroyPollTimer();
  setTimeout(() => {
    goBackToMain();

  }, 5000);
}

function updateCurrentState(): void {
  let full_meta: any[] = toRaw(workflowState.meta);
  let processes = toRaw(workflowState.processObjects);
  for (let name in workflowState.runStartMapping) {
    let meta: any[] = full_meta.filter((metaOb: any) => metaOb["run_name"] === name);
    meta = meta.reduce((latestMeta: any, currMeta: any) => {
      if (new Date(latestMeta["timestamp"]) > new Date(currMeta["timestamp"])) {
        return latestMeta;
      } else {
        return currMeta;
      }
    });
    adjustCurrentStateForRun(name, meta);
  }
  if (processes) {
    for (let process of processes) {
      if (process.status === "FAILED") {
        workflowState.failedProcesses = true;
        return;
      }
    }
  }
  workflowState.failedProcesses = false;
}


function updateProgress(): void {
  let loadParams: any = {runName: workflowState.selectedRun};
  axios.get(`${API_BASE_URL}run/progress/${workflowState.token}/`, {params: loadParams})
    .then(
      (response: any) => {
        workflowState.progress = response.data;
      }
    );

}


function adjustCurrentStateForRun(nameKey: string, meta: any) {

  if (meta['event'] === "started") {
    let processes: Process[] = toRaw(workflowState.processObjects);
    if (processes) {
      if (["SUBMITTED", "WAITING", undefined].includes(workflowState.currentState[nameKey])) {
        for (let process of processes) {
          if (process.status == "RUNNING") {
            workflowState.currentState[nameKey] = "RUNNING";
            return
          } else if (process.status == "COMPLETED") {
            workflowState.currentState[nameKey] = "RUNNING";
            return;
          }
        }
        workflowState.currentState = "SUBMITTED";
      }
    }
  } else if (meta['event'] === "completed") {
    if (meta["error_message"] !== null) {

      if (meta["error_message"] === "SIGINT") {
        workflowState.currentState[nameKey] = "ABORTED";
      } else {
        workflowState.currentState[nameKey] = "FAILED";
      }
    } else {
      workflowState.currentState[nameKey] = "COMPLETED";
    }
  } else {
    workflowState.currentState[nameKey] = "SUBMITTED";
  }

  checkForPollingTimerAdjustment();
}

function checkForPollingTimerAdjustment(): void {
  if (currentlyNonFinishedWorkflows()) {
    updateToFasterPolling();
  } else {
    updateToSlowerPolling();
  }
}

function currentlyNonFinishedWorkflows(): boolean {
  return !(Object.values(workflowState.currentState).every((state: any) => NON_AUTO_UPDATE_STATES.includes(state)));
}

function updateToFasterPolling(): void {
  if (workflowState.pollIntervalId) {
    clearInterval(workflowState.pollIntervalId)
    workflowState.pollIntervalValue = 0;
  }
  workflowState.pollIntervalId = setInterval(dataPollingLoop, FAST_INTERVAL);
  workflowState.pollIntervalValue = FAST_INTERVAL;
}

function updateToSlowerPolling(): void {
  if (workflowState.pollIntervalId) {
    clearInterval(workflowState.pollIntervalId)
    workflowState.pollIntervalValue = 0;
  }
  workflowState.pollIntervalId = setInterval(dataPollingLoop, SLOW_INTERVAL);
  workflowState.pollIntervalValue = SLOW_INTERVAL;
}

function updateRunningProcesses(): any {

  let processes: any = {};
  const allProcesses = toRaw(workflowState.processObjects);
  if (allProcesses) {
    for (let process of allProcesses) {
      if (process.status === "RUNNING") {
        if (!(process.process in processes)) {
          processes[process.process] = [process]
        } else {
          processes[process.process].push(process);
        }
      }
    }
  }

  return processes;
}

function severityFromWorkflowState(): string {
  const state: string = workflowState.currentState[workflowState.selectedRun];
  switch (state) {
    case "SUBMITTED":
      return "info"
    case "RUNNING":
      return "info"
    case "FAILED":
      return "error";
    case "ABORTED":
      return "warn";
    case "COMPLETED":
      return "success";
    default:
      return "info"
  }
}

function messageFromWorkflowState(): string {
  const state: string = workflowState.currentState[workflowState.selectedRun];
  switch (state) {
    case "SUBMITTED":
      return `The workflow run ${workflowState.selectedRun} was submitted, but no process has started yet`;
    case "RUNNING":
      return `The workflow run  ${workflowState.selectedRun} is currently running`;
    case "FAILED":
      return `Your workflow run ${workflowState.selectedRun} has failed!`;
    case "ABORTED":
      return `Your workflow run ${workflowState.selectedRun} has been aborted!`;
    case "COMPLETED":
      return `Your workflow run ${workflowState.selectedRun} has been successfully completed!`;
    default:
      return "There is no information to show yet. You may need to start a workflow or select a workflow run."
  }
}

function getSuffixes(strings: string[]) {
  return strings.map(str => {
    const parts = str.split(':');
    return parts[parts.length - 1];
  });
}

function latestMetaForRun(): any {
  if (workflowState.meta.length> 0) {
    const metas = workflowState.meta.filter((obj: any) => obj["run_name"] === workflowState.selectedRun);
    const lngt = metas.length;
    if (lngt > 0){
     return metas[lngt - 1]; 
    }
   } 

   return null;
  }

function getSuffix(str: string) {
  const parts: string[] = str.split(":");

  return parts[parts.length - 1];
}

function getDynamicDurationTypeAsNumber(duration: number, unit: any = null): number {
  if (!unit) {
    return duration;
  } else {
    switch(unit) {
      case 's': return duration / 1000
      case 'min': return duration / (1000 * 60)
      case 'h': return duration / (1000 * 60 * 60)
    }
    return duration;
  }
}

function getDynamicDurationType(duration: number): string {
  let durationInSeconds = duration / 1000;
  if (durationInSeconds > 60) {
    let durationInMinutes = durationInSeconds / 60;
    if (durationInMinutes > 60) {
      let durationInHours = durationInMinutes / 60;
      let fullHours = Math.floor(durationInHours);
      let rest = durationInHours - fullHours;

      return `${fullHours}:${(60 * rest).toFixed(0)} h`;
    } else {
      let fullMinutes = Math.floor(durationInMinutes);
      let rest = durationInMinutes - fullMinutes;

      return `${fullMinutes}:${(60 * rest).toFixed(0)}  min`;
    }
  } else {
    return `${durationInSeconds.toFixed(0)} s`;
  }
}

function getProcessNamesOnly(): any[] {
  mapAvailableProcesses();
  let state: any = toRaw(filterState.processTaskMapping);
  let keys: string[] = Object.keys(state);
  return keys.map(name => ({ name }));
}

function mapAvailableProcesses(): void {
  let result: any = {};
  let state: any = toRaw(workflowState.processObjects);
  if (state) {
    for (let process of state) {
      if (!(process.process in result)) {
        result[process.process] = [result.task_id]
      } else {
        result[process.process].push(result.task_id);
      }
    }
  }

  filterState.processTaskMapping = result;
}

function processNumbers(process: Process): string {
  process = toRaw(process);
  const currently_submitted: number = getNumberOfTasksForProcess(process.process);
  const completed: number = getNumberOfCompletedSubprocesses(process.process);
  return `${completed} / ${currently_submitted}`;
}

function getNumberOfTasksForProcess(processName: string): number {
  const allProcesses = toRaw(workflowState.processObjects);
  const processesByName: Process[] = allProcesses.filter((process: Process) => process.process === processName);
  return processesByName.length;
}

function getNumberOfCompletedSubprocesses(processName: string): number {
  const allProcesses = toRaw(workflowState.processObjects);
  const completedProcessesByName: Process[] = allProcesses.filter((process: Process) => process.process === processName && process.status === "COMPLETED");
  return completedProcessesByName.length;
}

function generateColorString(status: string): string {
  switch (status) {
    case 'SUBMITTED':
      return 'var(--cyan-300)';
    case 'ABORTED':
      return 'var(--orange-400)';
    case 'FAILED':
      return 'var(--red-600)';
    case 'RUNNING':
      return 'var(--teal-400)';
    case 'COMPLETED':
      return 'var(--green-600)';
    default:
      return 'var(--teal-50)';
  }
}

function getProgressValueForTask(status: string): number {

  switch (status) {
    case 'SUBMITTED':
      return 10;
    case 'ABORTED':
      return 30;
    case 'FAILED':
      return 20;
    case 'RUNNING':
      return 50;
    case 'COMPLETED':
      return 100;
    default:
      return 0;
  }

}


function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function deleteToken() {
  axios.delete(`${API_BASE_URL}token/remove/${workflowState.token}/`).then(
    response => {
      if (response.data["deleted"]) {
        toast.add({ severity: 'error', summary: 'Confirmed', detail: 'You have successfully deleted this token and all connected information. You will be redirected to the main-page.', life: 5000 });
        startBackToMainTimer();
      } else {
        toast.add({ severity: 'warn', summary: 'Failed', detail: 'Te deletion of the token has failed. Please try again!', life: 5000 });
      }
    }).finally(
      () => {
        return false;
      }
    );

}


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



function reasonableDataFormat(input: number) {
  const types: string[] = ['b', 'kiB', 'MiB', 'GiB'];
  let iteration: number = 0;
  if (input) {
    while (input >= 1024 && iteration < types.length) {
      input = input / 1024;
      iteration += 1;
    }
    return `${input.toFixed(3)} ${types[iteration]}`;
  } else {
    return "";
  }

}

function getSingleDataInValidStorageFormat(num: number, wantedType: string): number {
  const types: string[] = STORAGE_UNITS;
  let idx: number = 0;
  if (num) {
    while (types[idx] !== wantedType && idx < types.length) {
      num = num / 1024
      idx++;
    }
  }
}

function getDataInValidStorageFormat(byte_numbers: number[], wantedType: string): [number[], string] {
  const types: string[] = STORAGE_UNITS;
  let iteration: number = 0;

  if (byte_numbers.length > 0) {
    while (byte_numbers.some(elm => elm > 10000) && iteration < types.length - 1 && types[iteration] !== wantedType) {
      byte_numbers = byte_numbers.map((num): number => num / 1024);
      iteration++;
    }
  }
  return [byte_numbers, types[iteration]]

}

/** end of helper functions */

/** data retrieval functions */

function generateSummarizedDataByKey(key: string, factorizer: number = 1, unit: any = null): any {
  let data_pair: any = {};
  let processDataMapping: any = {};
  let tagFilter: boolean = false;
  let selectedTags: any = [];
  let processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses);
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);
  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      let value: any = process[key];
      if (value && unit) {
        if (TIME_UNITS.includes(unit)) {
          value = getDynamicDurationTypeAsNumber(value, unit);
        } else if (STORAGE_UNITS.includes(unit)) {
          value = getSingleDataInValidStorageFormat(value, unit);
        }
      }
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [value];
      } else {
        processDataMapping[process.process].push(value);
      }

    }
  }

  for (let processMap in processDataMapping) {
    if (factorizer !== 1 && unit === null) {
      processDataMapping[processMap] = processDataMapping[processMap].map((elem: number) => elem / factorizer);
    }
    processDataMapping[processMap] = processDataMapping[processMap].reduce((a: number, b: number) => a + b, 0);

  }

  data_pair["data"] = Object.values(processDataMapping);
  data_pair["labels"] = Object.keys(processDataMapping);
  data_pair['maxBarThickness'] = 30;
  return data_pair;
}

function generateDataByKey(key: string, adjustFormat: boolean, wantedFormat: string): any {
  let data_pair: any = {};
  let processDataMapping: any = {};
  let processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses);
  let tagFilter: boolean = false;
  let selectedTags: any[] = [];
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);
  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [process[key]]
      } else {
        processDataMapping[process.process].push(process[key]);
      }
    }
  }
  let temporaryValues: any[] = Object.values(processDataMapping);
  if (adjustFormat) {
    temporaryValues = temporaryValues.map((lst: any[]) => getDataInValidStorageFormat(lst, wantedFormat)[0]);
  }

  data_pair["data"] = temporaryValues;
  data_pair["labels"] = Object.keys(processDataMapping);
  data_pair['type'] = wantedFormat;
  data_pair['maxBarThickness'] = 30;
  return data_pair;
}

/** this could be more general? **/


function generateAnalysisRatioData(): [string[], any[]] {
  return [[],[]]; 
  // TODO: implement?
}

function unfoldTag(tag: any): string {
  if (tag[0] === "" || tag[0] === undefined){
    return ""
  } else if (tag[0] === '_'){
    return tag[1];
  } else {
    return `${tag[0]}: ${tag[1]}`;
  }
}




/** end of data retrieval functions */ 


function goToDiv(divId: string): void {
  let targetDiv = document.getElementById(divId);
  if (targetDiv) {
    targetDiv.scrollIntoView({ behavior: 'smooth' });
  }
}

/* on mounted */

onMounted(() => {
  FilterService.register('tagTableFilter', (value, filter): boolean => {
    filter = toRaw(filter);
    value = toRaw(value);

    if (filter === null) {
      return true;
    }

    let valueTags: any[] = [];

    for (let val of value) {
      valueTags.push(val);
    }

    let filterTags: any[] = [];

    for (let fil of filter) {
      filterTags.push(toRaw(fil));
    }

    const commonObjects = filterTags.filter((filObj: any) => valueTags.some((valueObj: any) => {
      return Object.keys(filObj)[0] === Object.keys(valueObj)[0] && Object.values(filObj)[0] === Object.values(valueObj)[0];
    }))

    return commonObjects.length > 0;
  });

  getDataInitial();
});

onUnmounted(() => {
  destroyPollTimer();
})

</script>

<template>
  <div class="card relative z-2 fixed-top bg-white">
    <Menubar :model="uiState.menuItems">
      <template #start>
        <img alt="logo" src="@/assets/traceflow.svg" height="40" class="mx-4" />
        <!-- todo: adjust to own logo -->

      </template>
      <template #end>
        <div class="mx-5">
          <h5>Workflow information for token {{ workflowState.token }}</h5>
        </div>
      </template>
    </Menubar>
  </div>

  <div class="limitPane py-3">
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
        <button @click="getDataInitial(workflowState.token)" class="btn btn-outline-primary" type="button">Show</button>
      </div>
    </div>
  </div>

  <div v-if="workflowState.token && workflowState.token_info_requested">

    <div class="card-body mt-4 py-4" v-if="workflowState.token && Object.keys(workflowState.runStartMapping).length > 0"
      id="run_selection_div">
      <h3 class="card-title">Select runs</h3>
      <div class="row flex flex-wrap m-2" v-for="key in Object.keys(workflowState.runStartMapping)">
        <div class="flex col-auto align-items-center">
          <RadioButton v-model="workflowState.selectedRun" v-on:update:model-value="adjustSelectedRun()" :input-id="key"
            :value="key" />
          <label :for="key" class="ms-2">
            {{ key }} - {{ workflowState.runStartMapping[key] ? ' started at ' +
              formattedDate(workflowState.runStartMapping[key]) : 'no start-date available' }}
              <span v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['workflow_scores'] && workflowState.fullAnalysis['workflow_scores']['full_scores']">
              - Score: <strong>{{ workflowState.fullAnalysis['workflow_scores']['full_scores'][key] ? ((workflowState.fullAnalysis['workflow_scores']['full_scores'][key]).toFixed(5) * 100).toFixed(2) + '%' : 'None'}}</strong>
              </span>
          </label>
        </div>
      </div>
    </div>

  
    <div class="card-body m-4" v-if="workflowState.selectedRun === ''">
      <div v-if="!(Object.keys(workflowState.runStartMapping).length > 0)">
        <h6 class="card-subtitle mb-2">
          There are no workflows connected to this token. Please use the following instructions to persist workflow
          metrics to this token.
        </h6>
        <div class="alert alert-dark">
          The following steps need to be taken:
          <ul>
            <li>Take a look at the current token - the full token is: <strong>{{ workflowState.token }}</strong>
            </li>
            <li>Start your nextflow workflow as you are used to. Just add the following command line arguments to
              the execution:
              <strong>{{ `-with-weblog ${API_BASE_URL}run/${workflowState.token}/` }}</strong>
            </li>
          <button
              @click="copyToClipboard( `-with-weblog ${API_BASE_URL}run/${workflowState.token}/`);"
                class="btn btn-outline-secondary"
               >Copy command line argument</button>
          </ul>
          So your command to execute will look similar to this: <br>
          <span class="text-muted">./nextflow run nextflow-io/elixir-workshop-21 -r master -with-docker -with-weblog
            {{API_BASE_URL}}run/{{ workflowState.token }}</span>
          <br>
          As soon as the first metrics have been sent to the token-specific-endpoint, you will be able to see the
          progress here.
        </div>
      </div>
      <div v-else>
        <Message :closable="false">
          Please select a workflow run above - should none be displayed to you, please wait a moment
        </Message>
      </div>

    </div>
    <div class="card-body mb-4">
      <Message v-if="currentlySelectedWorkflowHasPlottableData()" :closable="false"
        :severity="severityFromWorkflowState()">
        {{ messageFromWorkflowState() }}</Message>
      <Message v-if="workflowState.failedProcesses" severity="warn">There are processes, which failed during execution of
        the workflow!</Message>
      <Message :closable="false"
        v-if="checkIfProblemsFound()"
        severity="warn">
        In the analysis of the metrics, it was found that improvements can possibly be made in the development of the
        workflow.
        You are able to check this in the analysis section of this page.
      </Message>
    </div>
    <div class="card-body my-4" v-if="workflowState.selectedRun && workflowState.meta.length > 0">
  
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><strong>Run Information</strong></li>
        <li class="list-group-item" v-if="latestMetaForRun()['commmand_line']">Command Line - {{latestMetaForRun()['commmand_line']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['nextflow_version']">Nextflow Version - {{latestMetaForRun()['nextflow_version']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['work_dir']">Work Directory - {{latestMetaForRun()['work_dir']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['user_name']">User Name - {{latestMetaForRun()['user_name']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['project_name']">Project Name - {{latestMetaForRun()['project_name']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['revision']">Revision - {{latestMetaForRun()['revision']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['script_file']">Command Line - {{latestMetaForRun()['script_file']}}</li>
      </ul>
      
    </div>
    <div class="card-body my-4" v-if="currentlySelectedWorkflowHasPlottableData()" id="progess_summary_div">
      <progressComponentVue :progress="workflowState.progress" />

    </div>

    <div class="card-body my-5" v-if="Object.keys(workflowState.runningProcesses).length > 0">
    

      <Fieldset legend="Currently Running" :toggleable="true">

        <div class="card-body my-4">
          <Message closable >This area displays the tasks, grouped by process, that are currently running and correspond to the settings of the following filter</Message>
        <div class="row my-3">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedRunningProcesses" :options="filterState.availableProcesses"
              v-on:change="runningProcessSelectionChanged();" :showToggleAll=false filter placeholder="Select Processes"
              display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
              :disabled="filterState.autoselectAllRunningProcesses">
            </MultiSelect>
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllRunningProcesses" v-on:click="unselectAllRunningProcesses()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllRunningProcesses" v-on:click="selectAllRunningProcesses()"
              label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllRunningProcesses"
              onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionRunning()"
              onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="runningProcessAutoSelectionChanged()" />
          </div>
        </div>
        <div class="row my-3">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedRunningTags" :options="filterState.availableTags"
              v-on:change="runningTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag" display="chip"
              class="md:w-20rem" style="max-width: 40vw" optionLabel="name" :disabled="filterState.autoselectAllRunningTags">
              <template #chip="selectedTag">
                <div class="flex align-items-center">
                  <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
                    Object.values(selectedTag.value)[0] }}</div>
                  <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
                </div>
              </template>
              <template #option="slotProps">
                <div class="flex align-items-center">
                  <div v-if="Object.keys(slotProps.option)[0] !== ''">
                    {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
                  </div>
                  <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
                </div>
              </template>
            </MultiSelect>
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllRunningTags" v-on:click="unselectAllRunningTags()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllRunningTags" v-on:click="selectAllRunningTags()" label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllRunningTags" onLabel="Autoupdate enabled"
              offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionRunningTags()" onIcon="pi pi-check"
              offIcon="pi pi-times" v-on:change="runningTagAutoSelectionChanged()" />
          </div>
        </div>
  
  
      </div>

        <div v-for="(info, process) in workflowState.filteredRunningProcesses" class="row my-2">
        <Panel toggleable :collapsed="true"
        :header="`${process}: ${info.length > 1 ? info.length + ' tasks' : ' 1 task'}`">
          <ul class="list-group list-group-flush">
            <li v-for="task of info"
            class="list-group-item"><strong>Task #{{ task['task_id'] }}<span :class="task['attempt'] > 1 ? 'text-danger' : ''"> - attempt {{ task['attempt'] }}</span></strong> <Tag class="m-1" v-for="tag_elem of task['tag']"
              :value="Object.keys(tag_elem)[0] === '' ? 'Empty Tag' : Object.keys(tag_elem)[0] + ': ' + Object.values(tag_elem)[0]"></Tag>
            </li>
          </ul>
        </Panel>
    
      </div>
      </Fieldset>
      


    </div>

    <div class="my-5 py-2"
      v-if="workflowState.token_info_requested && workflowState.processObjects?.length > 0 && !workflowState.error_on_request">
      <hr>
      <h5 class="card-title">By process</h5>
  
      <div class="my-3">
      
        <!-- also check if this can be made better-->
        <Panel class="my-2" header="Progress by process" toggleable collapsed :pt="{
          header: { style: { 'max-height': '50px' } },
          root: { class: 'mt-1 mb-1' }
        }">
        <div class="row my-2 py-2">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedProgressProcesses" :options="filterState.availableProcesses"
              :disabled="filterState.autoselectAllProgressProcesses"
              v-on:update:model-value="progressProcessSelectionChanged()" :showToggleAll="false" filter
              placeholder="Select Processes" optionLabel="name" display="chip" class="md:w-20rem"
              style="max-width: 40vw" />
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllProgressProcesses" v-on:click="unselectAllProgressProcesses()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllProgressProcesses" v-on:click="selectAllProgressProcesses()"
              label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton v-model="filterState.autoselectAllProgressProcesses"
              v-on:change="progressProcessAutoSelectionChanged()" onLabel="Autoupdate enabled"
              offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionProgress()" onIcon="pi pi-check"
              offIcon="pi pi-times" /> <!-- need function to handle this -->
          </div>
        </div>
        <ul class="list-group list-group-flush justify-content-end">
        <li v-for="(info, process) in workflowState.filteredProgressProcesses" class="p-2 list-group-item d-flex justify-content-between align-items-center">
          <span class="float-left"><strong>{{process}}</strong></span><span class="float-right">{{ processNumbers(info) }} tasks complete</span>
          <!-- TODO: add failed here ? -->
        </li>
      </ul>
      </Panel>
        
      </div>


      <hr>
      <div class="card-body my-5" id="process_information_div">
        <h3 class="card-title">Task Information for {{ workflowState.selectedRun }} </h3>
        <div class=m-4></div>
  
        <DataTable :value="workflowState.tablePageData" sortField="task_id" :sortOrder="1" v-model:filters="filters"
          filterDisplay="row" tableStyle="min-width: 50rem" :totalRecords="filterState.totalTableRecords" :paginator="true" :lazy="true" :rows="10" :rowsPerPageOptions="[10, 20, 50]"
          :rowClass="rowClass" removableSort
          @onLazyLoad="updateTablePageData"
          @page="updateTablePageData" 
          @sort="updateTablePageData"
          @filter="updateTableFilter"
          :loading="filterState.tableLoading"

          >
          <Column field="task_id" header="Task-ID" sortable :frozen="true"></Column>
          <Column header="Problematic" field="problematic" :frozen="true">
            <template #body="{ data }">
              <Tag v-if="isProblematic(data)" value="Problematic" severity="danger"></Tag>
            </template>
          </Column>
          <Column field="process" header="Process" style="min-width: 20rem" sortable :show-filter-menu="false"
            filter-field="process" :frozen="true">
            <template #filter="{ filterModel, filterCallback }">
              <InputText v-model="filterModel.value" type="text" @input="filterCallback()" class="p-column-filter"
                placeholder="Search by process" />
            </template>
            <template #body="{ data }">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{ getSuffix(data.process) }}</span>
            </template>
          </Column>
          <Column field="status" style="min-width: 12rem" header="Status" sortable filter-field="status"
            :show-filter-menu="false" :filter-match-mode="'contains'">
            <!-- adjust it to be a dropdown! -->
            <template #body="{ data }">
              <Tag :value="data.status" />
            </template>
            <template #filter="{ filterModel, filterCallback }">
              <MultiSelect v-model="filterModel.value" style="max-width: 12rem" display="chip" @change="filterCallback()"
                :pt="{
                  token: {
                    style: { 'max-width': '8rem' }
                  },
                  tokenLabel: { style: { 'font-size': '10px' } }
                }" :options="STATUSES" placeholder="Any" class="p-column-filter">
                <template #header>

                </template>
                <template #option="slotProps">
                  <Tag :value="slotProps.option" />
                </template>
              </MultiSelect>
            </template>
          </Column>


          <Column field="tag" header="Tag" style="min-width: 20rem" :show-filter-menu="false" sortable>
            <template #filter="{ filterModel, filterCallback }">
              <MultiSelect v-model="filterModel.value" :options="filterState.availableTags" :showToggleAll=false filter
                placeholder="Select Tag" @change="filterCallback()" display="chip" class="md:w-20rem"
                style="max-width: 40vw" optionLabel="name">
                <template #chip="selectedTag">
                  <div class="flex align-items-center">
                    <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
                      Object.values(selectedTag.value)[0] }}</div>
                    <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
                  </div>
                </template> 
                <template #option="slotProps">
                  <div class="flex align-items-center">
                    <div v-if="Object.keys(slotProps.option)[0] !== ''">
                      {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
                    </div>
                    <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
                  </div>
                </template>
              </MultiSelect>
            </template>
            <template #body="{ data }">
              <Tag v-for="(tag, id) of getTagsFromString(data.tag)"
                :value="Object.keys(tag)[0] === '' ? 'Empty tag' : Object.keys(tag)[0] + ': ' + Object.values(tag)[0]">
              </Tag>             
            </template>
          </Column>
          <Column field="attempt" header="Attempts" sortable>
          </Column>
          <Column field="timestamp" header="Timestamp" sortable>
          <!-- empty TODO: fix--> </Column>
          <Column field="process_hash" header="Hash" sortable>
          <!-- empty TODO: fix--> </Column>
          <Column field="duration" sortable header="Duration">
            <template #body="{ data }">
              <span v-if="data.duration">{{ getDynamicDurationType(data.duration) }} </span>
              <span v-else>No data</span>
            </template>

          </Column>
          <Column field="cpus" header="Requested CPUs" sortable></Column>
          <Column field="cpu_percentage" header="CPU %" style="min-width: 150px;" sortable>
            <template #body="{ data }">
              <span v-if="data['cpu_percentage']">
                {{ data["cpu_percentage"].toFixed(2) }} %</span>
              <span v-else>No data</span>

            </template>

          </Column>
          <Column header="CPU allocation" sortable field="allocation" :sort-field="cpuAllocationSort">
            <template #body="{ data }">
              <span v-if="data['cpu_percentage'] && data['cpus']">
                {{ (data['cpu_percentage'] / data['cpus']).toFixed(2) }} %
              </span>
            </template>
          </Column>
          <Column field="memory_percentage" header="Memory %" sortable >
            <template #body="{ data }">
              <span v-if="data.memory_percentage">
                {{ data.memory_percentage }} %
              </span>
              <span v-else>
                No Data
              </span>
            </template>
          </Column>
          <Column field="memory_allocation" header="Memory allocation (Physical)" sortable :sort-field="memoryAllocationSort">
          <template #body="{ data }">
            <span v-if="data.rss && data.memory">{{((data.rss / data.memory) * 100).toFixed(2)}}%</span>
            <span v-else>No data</span>
          </template>
          </Column>
          <Column field="memory" header="Requested Memory" sortable>
            <template #body="{ data }">
              <span v-if="data.memory">{{ reasonableDataFormat(data.memory) }}</span>
              <span v-else>No Data</span>
            </template>
          </Column>
          <Column field="rss" header="rss" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.rss) }}
            </template>
          </Column>
          <Column field="peak_rss" header="Peak rss" sortable>
            <template #body="{ data }">
              <span v-if="data.peak_rss">{{ reasonableDataFormat(data.peak_rss) }}</span>
              <span v-else>No Data</span>
            </template>
          </Column>

          <Column field="peak_vmem" header="Peak VMem" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.peak_vmem) }}
            </template>
          </Column>
          <Column field="vmem" header="VMem" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.vmem) }}
            </template>
          </Column>
          <Column field="disk" header="Disk" sortable>
            <template #body="{ data }">
              <span v-if="data.disk">
                {{ data.disk }} %
              </span>
              <span v-else>
                No Data
              </span>
            </template>
          </Column>
          <Column field="rchar" header="rchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.rchar) }}

            </template>
          </Column>
          <Column field="wchar" header="wchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.wchar) }}
            </template>
          </Column>
          <Column field="read_bytes" header="I/O Read" sortable>
            <template #body="{ data }">
              <span v-if="data.read_bytes">{{ reasonableDataFormat(data.read_bytes) }}</span>
            <span v-else>No data</span>
            </template>
          </Column>
          <Column field="write_bytes" header="I/O Write" sortable>
            <template #body="{ data }">
              <span v-if="data.write_bytes">{{ reasonableDataFormat(data.write_bytes) }}</span>
              <span v-else>No data</span>
            </template>
          </Column>
          <Column field="syscr" header="syscr" sortable></Column>
          <Column field="syscw" header="syscw" sortable></Column>
          <Column field="vol_ctxt" header="Voluntary context switches" sortable></Column>
          <Column field="inv_ctxt" header="Involuntary cs" sortable></Column>
          <Column field="time" header="Time" sortable>
            <template #body="{ data }">
              {{ data.time / 1000 }} s
            </template>
          </Column>
          <Column field="realtime" header="Realtime" sortable>
            <template #body="{ data }">
              <span v-if=data.realtime>{{ getDynamicDurationType(data.realtime) }}</span>
              <span v-else>No Data</span>
            </template>
          </Column>
          <Column field="name" style="min-width: 20rem" header="Name" sortable :show-filter-menu="false"
            filter-field="name">
            <template #body="{ data }">
              {{ data.name }}
            </template>
            <template #filter="{ filterModel, filterCallback }">
              <InputText v-model="filterModel.value" type="text" @input="filterCallback()" class="p-column-filter"
                placeholder="Filter name" />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>

  <div class="card-body my-4" v-if="currentlySelectedWorkflowHasPlottableData()" id="metric_visualization_div">
    <div>
      <h3 class="my-3">Metric Visualizaton</h3>
      <!-- TODO FIX: plots do not get loaded on page load but with second retrieval of data-->
    </div>
    <div class="card-body my-3">
      <div class="row my-3">
        <div class="col-6">
          <MultiSelect v-model="filterState.selectedMetricProcesses" :options="filterState.availableProcesses"
            v-on:change="metricProcessSelectionChanged();" :showToggleAll=false filter placeholder="Select Processes"
            display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
            :disabled="filterState.autoselectAllMetricProcesses">
          </MultiSelect>
        </div>
        <div class="col-3">
          <Button :disabled="filterState.autoselectAllMetricProcesses" v-on:click="unselectAllMetricProcesses()"
            label="Deselect all" />
          <Button :disabled="filterState.autoselectAllMetricProcesses" v-on:click="selectAllMetricProcesses()"
            label="Select all" />
        </div>
        <div class="col-3">
          <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllMetricProcesses"
            onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionMetric()"
            onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="metricProcessAutoSelectionChanged()" />
        </div>
      </div>
      <div class="row my-3">
        <div class="col-6">
          <MultiSelect v-model="filterState.selectedTags" :options="filterState.availableTags"
            v-on:change="metricTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag" display="chip"
            class="md:w-20rem" style="max-width: 40vw" optionLabel="name" :disabled="filterState.autoselectAllMetricTags">
            <template #chip="selectedTag">
              <div class="flex align-items-center">
                <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
                  Object.values(selectedTag.value)[0] }}</div>
                <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
              </div>
            </template>
            <template #option="slotProps">
              <div class="flex align-items-center">
                <div v-if="Object.keys(slotProps.option)[0] !== ''">
                  {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
                </div>
                <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
              </div>
            </template>
          </MultiSelect>
        </div>
        <div class="col-3">
          <Button :disabled="filterState.autoselectAllMetricTags" v-on:click="unselectAllMetricTags()"
            label="Deselect all" />
          <Button :disabled="filterState.autoselectAllMetricTags" v-on:click="selectAllMetricTags()" label="Select all" />
        </div>
        <div class="col-3">
          <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllMetricTags" onLabel="Autoupdate enabled"
            offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionTags()" onIcon="pi pi-check"
            offIcon="pi pi-times" v-on:change="metricTagAutoSelectionChanged()" />
        </div>
      </div>

      <div class="row my-3">
        <div class="col-3">
          <h6 class="p-2">Memory Format</h6>
        </div>
        <div class="col-6 d-flex justify-content-between align-items-center">
            <div class="p-2">
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_b" value="b" 
             @change="updatePlotsConditional" />
              <label for="mem_format_selection_b" class="mx-1">Bytes</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_kib" value="kiB"
              @change="updatePlotsConditional" />
              <label for="mem_format_selection_kib" class="mx-1">kiB</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_mib" value="MiB" 
              @change="updatePlotsConditional" />
              <label for="mem_format_selection_mib" class="mx-1">MiB</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_gib" value="GiB" 
              @change="updatePlotsConditional" />
              <label for="mem_format_selection_gib" class="mx-1">GiB</label>
            </div>
          </div>
      </div>

      <div class="row my-3">
        <div class="col-3">
          <h6 class="p-2">Duration Format</h6>
        </div>
        <div class="col-4 d-flex justify-content-between align-items-center">
            <div class="p-2">
              <RadioButton v-model="metricCharts.durationFormat" id="duration_format_selection_s" value="s" 
              @change="updatePlotsConditional"/>
              <label for="duration_format_selection_s" class="mx-1">s</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.durationFormat" id="duration_format_selection_min" value="min"
              @change="updatePlotsConditional" />
              <label for="duration_format_selection_min" class="mx-1">min</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.durationFormat" id="mem_format_selection_mib" value="h"
              @change="updatePlotsConditional" />
              <label for="duration_format_selection_h" class="mx-1">h</label>
            </div>
          </div>
      </div>


    </div>
    <div class="card-body my-4 py-2" id="canvas_area">
      <div class="plot-section">
        <h5>RAM</h5>
        <canvas id="ram_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.memoryChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>Relative RAM</h5>
        <canvas id="relative_ram_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.relativeMemoryChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>CPU</h5>
        <canvas id="cpu_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>I/O</h5>
        <canvas id="io_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.ioChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>Duration</h5>
        <canvas id="duration_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.durationChart.resetZoom()"/>
      </div>
    </div>
    <hr>
  </div>

  <div class="card-body my-4" v-if="currentlySelectedWorkflowHasPlottableData() && workflowState.fullAnalysis" id="analysis_div">
    <div class="card-header">
      <h3>Analysis</h3>
    </div>
    <div class="my-4" v-if="requestState.request_params['valid_cpu_allocation_deviation']">
      <h5>Settings</h5>
      <p>Below you can adjust the thresholds to consider for analysis.</p>
      <div class="my-3">
        <div class="row p-1 m-2">
          <div class="col-4 p-1 align-content-center">
            Valid CPU allocation deviation percentage
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['valid_cpu_allocation_deviation']"
            mode="decimal" showButtons
              :min="0" :max="100" />
          </div>
        </div>
        <div class="row p-1 m-2">
          <div class="col-4 p-1 align-content-center">
            Valid Memory allocation deviation percentage
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['valid_memory_allocation_deviation']"
            mode="decimal" showButtons
              :min="0" :max="100" />
          </div>
        </div>
        <div class="row p-1 m-2">
          <div class="col-4 p-1 align-content-center">
            Weighting of CPU and RAM metrics
          </div>
          <div class="col-6">
            <div class="row">
              <div class="col-3"><Chip :label="(requestState.request_params['cpu_weight'] * 100).toFixed(0) + ' %'" /></div>
              <div class="col-6 mt-3">
                <Slider v-model="requestState.request_params['cpu_ram_slide']" :step="1" class="w-14rem" v-on:change="recalculateWeights()" />
              </div>
              <div class="col-3"><span><Chip :label="(requestState.request_params['ram_weight'] * 100).toFixed(0) + ' %'" /></span></div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr>
    <div class="card-body my-2" v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['workflow_scores']">
      <div class="p-4">
        <h6>Score for this run</h6>
        <div class="my-1" v-if="workflowState.fullAnalysis['workflow_scores']['full_scores'] && workflowState.fullAnalysis['workflow_scores']['full_scores'][workflowState.selectedRun] > -0.01">
          <div class="row">
            <div class="col-2">
              <strong>{{(workflowState.fullAnalysis['workflow_scores']['full_scores'][workflowState.selectedRun] * 100).toFixed(2)}} %</strong>
            </div>
            <div class="col-10">
              <ProgressBar :value="parseInt((workflowState.fullAnalysis['workflow_scores']['full_scores'][workflowState.selectedRun] * 100).toFixed(0))"></ProgressBar>
            </div>
          </div>
        </div>
        <div class="my-1" v-else>
          <Message>There is no score for this workflow run yet.</Message>
        </div>
      </div>
      <div class="p-4" >
        <h6>Score Comparison</h6>
        <div v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['workflow_scores'] && workflowState.fullAnalysis['workflow_scores']['full_scores']">
        <div class="my-1" v-for="score_run in sortByScore(workflowState.fullAnalysis['workflow_scores']['full_scores'])">
          <div class="row" v-if="workflowState.fullAnalysis['workflow_scores']['full_scores'] && workflowState.fullAnalysis['workflow_scores']['full_scores'][score_run] > -0.01">
            <div class="col-2">
              <strong v-if="score_run === workflowState.selectedRun">{{ score_run }} - {{(workflowState.fullAnalysis['workflow_scores']['full_scores'][score_run] * 100).toFixed(2)}} %</strong>
              <span v-else>{{ score_run }} - {{(workflowState.fullAnalysis['workflow_scores']['full_scores'][score_run] * 100).toFixed(2)}} %</span>
            </div>
            <div class="col-10">
              <ProgressBar :style="{'height': score_run === workflowState.selectedRun ? '12px': '2px'}"
              :value="parseInt((workflowState.fullAnalysis['workflow_scores']['full_scores'][score_run] * 100).toFixed(0))"
              :showValue="false"
              ></ProgressBar>
            </div>
          </div>
        </div>
      </div>
        <div v-else>
          There are no scores to show at the moment
        </div>
      </div>
      <div class="my-4" v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['workflow_scores'] && workflowState.fullAnalysis['workflow_scores']['task_information'] && workflowState.fullAnalysis['workflow_scores']['task_information'][workflowState.selectedRun]">
        <h5 class="my-2">Allocation Scores by Task</h5>
        <DataTable v-model:expandedRows="filterState.expandedRows"
        :value="workflowState.fullAnalysis['workflow_scores']['task_information'][workflowState.selectedRun]"
        paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" :removable-sort="true" sortField="pure_score" :sort-order="-1"
         tableStyle="min-width: 80rem ">
          <Column field="task_id" sortable header="Task ID"/>
          <Column field="process" sortable header="Process">
            <template #body="{data}">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{getSuffix(data.process)}}</span>
            </template>
          </Column>
          <Column field="tag" header="Tags">
            <template #body={data}>
              <Tag class="mx-1" v-for="tag_elem of getTagsFromString(data.tag)"
                :value="Object.values(tag_elem)[0] === null ? 'Empty tag' : `${tag_elem[Object.keys(tag_elem)[0]]}: ${Object.values(tag_elem)[0]}`" 
              ></Tag>
            </template>
          </Column>
          <Column field="pure_score" sortable header="Allocation Score">
        
          <template #body={data}>
            <span v-if="data['pure_score'] !== null"><strong>{{(data['pure_score'] * 100).toFixed(2)}}%</strong></span>
            <span v-else><strong>No combined score</strong></span>
          </template></Column>
          <Column field="raw_cpu_score" sortable header="CPU Score">
        
            <template #body={data}>
              <span v-if="data['raw_cpu_score'] !== null"><strong>{{(data['raw_cpu_score'] * 100).toFixed(2)}}%</strong></span>
              <span v-else><strong>No score</strong></span>
            </template></Column>
            <Column field="raw_memory_score" sortable header="Memory Score">
        
              <template #body={data}>
                <span v-if="data['raw_memory_score'] !== null"><strong>{{(data['raw_memory_score'] * 100).toFixed(2)}}%</strong></span>
                <span v-else><strong>No score</strong></span>
              </template></Column>
        </DataTable> 

        <h5 class="my-2">Scores by Process and Problems</h5>
        <DataTable v-model:expandedRows="filterState.expandedRows"
        :value="workflowState.fullAnalysis['workflow_scores']['process_scores'][workflowState.selectedRun]"
        paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" :removable-sort="true" sortField="score" :sort-order="-1"
         tableStyle="min-width: 80rem">
          <Column expander></Column>
          <Column field="process" sortable header="Process">
            <template #body="{data}">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{getSuffix(data.process)}}</span>
            </template>
          </Column>
          <Column field="score" sortable header="Score">
          
          <template #body={data}>
            <span v-if="data.score !== null"><strong>{{(data.score * 100).toFixed(2)}}%</strong></span>
            <span v-else><strong>No score</strong></span>
          </template></Column>
          <Column field="problems" sortable header="Problems">
            <template #body={data}>
              <span v-if="data.problems.length === 0"><strong>No problems</strong></span>
              <Tag v-else severity="danger">{{data.problems.length}}</Tag>
            </template>
          </Column>
          <template #expansion="slotProps">
            <div class="p-3" v-if="slotProps.data.problems.length > 0">
                <Panel class="mb-3" :header="'Problem #' + (index + 1)" toggleable v-for="(problem, index) of slotProps.data.problems">
                  <p class="m-1">
                    {{showProblem(problem)}}
                  </p>
              </Panel>
            </div>
            <div class="p-3" v-else>
              <span>There are no problems detected for this task</span>
            </div>
        </template>
        </DataTable>

      </div>
    </div>
    <div class="card-body my-5 py-2" id="analysis_canvas_area">
      <div class="plot-section">
        <h5>CPU-RAM ratio</h5>
        <canvas id="cpu_ram_ratio" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuRamRatioChart.resetZoom()"/>
      </div>

    </div>
    <Message severity="info" :closable="false">
      {{ analysisInfo.cpuRamRatioText }}
    </Message>

    <hr>

    <div class="card-body my-4">
      <h6>Duration</h6>
      <div v-if="workflowState.fullAnalysis['bad_duration']"
        class="my-3">
        <Message>
          Below is a list of tasks, which need the most time for execution - from submission to completion.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_duration_tasks'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['bad_duration_tasks'][workflowState.selectedRun].length" class="p-2">
          <Column field="task_id" header="Task-ID"></Column>
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process']) }}</span>
            </template>
          </Column>
          <Column field="tag" header="Tags">
            <template #body={data}>
              <Tag class="mx-1" v-for="tag_elem of getTagsFromString(data.tag)"
                :value="Object.values(tag_elem)[0] === null ? 'Empty tag' : `${tag_elem[Object.keys(tag_elem)[0]]}: ${Object.values(tag_elem)[0]}`" 
              ></Tag>
            </template>
          </Column>
          <Column field="duration" header="Duration" sortable>
            <template #body="{ data }">
              <span v-if="data['duration']">
                {{ getDynamicDurationType(data['duration']) }}
              </span>
              <span v-else>No data</span>
            </template>
          </Column>

        </DataTable>
      </div>
      <div
        v-if="workflowState.fullAnalysis['bad_duration_processes_sum'] && workflowState.fullAnalysis['bad_duration_processes_sum'][workflowState.selectedRun]">
        <Message>
          Below is a list of processes which need the most time for execution, summarized over all task instances of this process.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_duration_processes_sum'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['bad_duration_processes_sum'][workflowState.selectedRun].length">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process']) }}</span>
            </template>
          </Column>
          <Column field="duration" header="Duration summarized" sortable>
            <template #body="{ data }">
              {{ getDynamicDurationType(data['sum']) }}
            </template>
          </Column>
        </DataTable>
      </div>

      <div
        v-if="workflowState.fullAnalysis['bad_duration_processes_average'] && workflowState.fullAnalysis['bad_duration_processes_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which need the most time for execution, averaged over all tasks of process.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_duration_processes_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['bad_duration_processes_average'][workflowState.selectedRun].length" class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process']) }}</span>
            </template>
          </Column>
          <Column field="duration" header="Duration in average" sortable>
            <template #body="{ data }">
              {{ getDynamicDurationType(data['average']) }}
            </template>
          </Column>
        </DataTable>
      </div>

      <div v-else>
        <Message severity="info">There currently is no information to show regarding the duration of processes</Message>
      </div>
    </div>

    <div class="card-body my-4">
      <h6>CPU </h6>
      <div v-if="workflowState.fullAnalysis['bad_cpu_allocation_tasks'] && workflowState.fullAnalysis['bad_cpu_allocation_tasks'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of tasks which have the worst CPU allocation. Here, the deviation from the 100% optimum is considered.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_cpu_allocation_tasks'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem" :rows="workflowState.fullAnalysis['bad_cpu_allocation_tasks'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="task_id" header="Task-ID"></Column>
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process']) }}</span>
            </template>
          </Column>
          <Column field="tag" header="Tags">
            <template #body={data}>
              <Tag class="mx-1" v-for="tag_elem of getTagsFromString(data.tag)"
                :value="Object.values(tag_elem)[0] === null ? 'Empty tag' : `${tag_elem[Object.keys(tag_elem)[0]]}: ${Object.values(tag_elem)[0]}`" 
              ></Tag>
            </template>
          </Column>
          <Column field="allocation" header="CPU allocation %" sortable>
            <template #body="{ data }">
              <span v-if="data['cpu_allocation']">
                {{ (data["cpu_allocation"]).toFixed(2) }} %
              </span>
              <span v-else >
                No data
                </span>
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-if="workflowState.fullAnalysis['cpu_allocation_deviation_sum'] && workflowState.fullAnalysis['cpu_allocation_deviation_sum'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the worst CPU allocation in summary. The deviation from the 100% optimum is added up over all tasks of a process.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['cpu_allocation_deviation_sum'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem" :rows="workflowState.fullAnalysis['cpu_allocation_deviation_sum'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process_name, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process_name']) }}</span>
            </template>
          </Column>
          <Column field="sum" header="CPU allocation" sortable>
            <template #body="{ data }">
              {{ data["deviation_sum"].toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-else>
        <Message severity="info">There currently is no information to show regarding the CPU allocation of processes
        </Message>
      </div>
      
      <div v-if="workflowState.fullAnalysis['cpu_allocation_deviation_average'] && workflowState.fullAnalysis['cpu_allocation_deviation_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the worst CPU allocation in average. The value represents the averaged deviation for all tasks of the process, regarding the 100%-optimum.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['cpu_allocation_deviation_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem" :rows="workflowState.fullAnalysis['cpu_allocation_deviation_average'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process_name, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process_name']) }}</span>
            </template>
          </Column>
          <Column field="allocation" header="CPU allocation" sortable>
            <template #body="{ data }">
              {{ data["deviation_average"].toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-else>
        <Message severity="info">There currently is no information to show regarding the CPU allocation of processes
        </Message>
      </div>
    </div>

    <div class="card-body my-4">
      <h6>Memory</h6>
      <div
        v-if="workflowState.fullAnalysis['bad_memory_allocation_tasks'] && workflowState.fullAnalysis['bad_memory_allocation_tasks'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of tasks which have the worst Memory allocation percentages, considering the deviation from the 100%-optimum.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_memory_allocation_tasks'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['bad_memory_allocation_tasks'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process']) }}</span>
            </template>
          </Column>
          <Column field="tag" header="Tags">
            <template #body={data}>
              <Tag class="mx-1" v-for="tag_elem of getTagsFromString(data.tag)"
                :value="Object.values(tag_elem)[0] === null ? 'Empty tag' : `${tag_elem[Object.keys(tag_elem)[0]]}: ${Object.values(tag_elem)[0]}`" 
              ></Tag>
            </template>
          </Column>
          <Column field="memory_allocation" header="Memory Allocation % average" sortable>
            <template #body="{ data }">
              <span v-if="data['memory_allocation']">
                {{ (data["memory_allocation"]).toFixed(2) }} %
              </span>
              <span v-else >
                No data
                </span>
            </template>
          </Column>
        </DataTable>
      </div>
      <div
        v-if="workflowState.fullAnalysis['memory_allocation_deviation_sum'] && workflowState.fullAnalysis['memory_allocation_deviation_sum'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the worst Memory allocation percentage summed up over all process. The deviation from the 100% optimum is added up over all tasks of a process.
          instances.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['memory_allocation_deviation_sum'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['memory_allocation_deviation_sum'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process_name, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process_name']) }}</span>
            </template>
          </Column>
          <Column field="memory_allocation" header="Memory Allocation % average" sortable>
            <template #body="{ data }">
              {{ (data["deviation_sum"]).toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>

      <div
        v-if="workflowState.fullAnalysis['memory_allocation_deviation_average'] && workflowState.fullAnalysis['memory_allocation_deviation_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes with the worst average Memory allocation. The value represents the averaged deviation for all tasks of the process, regarding the 100%-optimum.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['memory_allocation_deviation_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['memory_allocation_deviation_average'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process_name, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process_name']) }}</span>
            </template>
          </Column>
          <Column field="memory_allocation" header="Memory Allocation % average" sortable>
            <template #body="{ data }">
              {{ (data["deviation_average"]).toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      
      
      <div
        v-if="workflowState.fullAnalysis['bad_memory_ratio'] && workflowState.fullAnalysis['bad_memory_ratio'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the worst values regarding the ratio between physical memory and the
          combined total of physical memory and swap space utilization.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_memory_ratio'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['bad_memory_ratio'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              <span v-tooltip="{value: data.process_name, showDelay: 500, hideDelay: 200}">{{ getSuffix(data['process_name']) }}</span>
            </template>
          </Column>
          <Column field="memory_relation" header="Ratio (physical/vmem) in %" sortable>
            <template #body="{ data }">
              {{ (data["ratio_average"] * 100).toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-else>
        <Message severity="info">There currently is no information to show regarding the memory allocation of processes
        </Message>
      </div>
    </div>

  
  </div>
  <hr>
  <div class="card-body my-4" v-if="workflowState.error_on_request">
    <div class="alert alert-info">
      This token is not correct, please enter another token
    </div>
  </div>
  <div class="card-body my-4" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
    <div type="button" class="btn btn-outline-danger" @click="confirmDeletion();">
      Delete token
    </div>

  </div>
</div>
  <Sidebar v-model:visible="uiState.sidebarVisible" :pt="{
          closeButton : { class: 'd-none'}
      }">
  <template #header>
    <div class="row justify-content-end">
      <div class="col-auto">
        <h5 class="mt-2">Navigate</h5>
      </div>
      <div class="col-auto">
        <Button size="small" icon="pi pi-arrow-left" label="Close" @click="changeSidebarState(false)"></Button>
      </div>
    </div>
  </template>
  <ul class="list-group list-group-flush">
    <li class="list-group-item list-group-item-action nav-lg-item" id="run-selection-nav-item"
      @click="goToDiv('run_selection_div')">Run Selection</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="progress-nav-item"
      @click="goToDiv('progess_summary_div')">Progress</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="process-information-nav-item"
      @click="goToDiv('process_information_div')">Task Information</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="metric-nav-item"
      @click="goToDiv('metric_visualization_div')">Metric Visualizaton</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="analysis-nav-item"
      @click="goToDiv('analysis_div')">Analysis</li>
  </ul>


</Sidebar>

<ScrollTop />
<Toast position="center" />
<ConfirmDialog></ConfirmDialog></template>

<style scoped></style>
