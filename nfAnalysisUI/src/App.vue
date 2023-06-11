<script lang="ts">

import {defineComponent, reactive, toRefs} from "vue";
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'
import axios from "axios";
//import { UserComponent } from "./components/userComponent/userComponent.vue"

export default defineComponent({
    name: 'App',
    components: {},
    data() {
        return {
            entered_token: "",
            token: "",
            user: {
                name: "",
                run_tokens: [],
            },
            faultyResponse: false,
            runData: null,
        }
    },
    methods: {


        getUserData(userToken: string) {
            axios.get(`http://localhost:8000/user/token/${userToken}`).then(
                response => {
                    console.log(response);
                    if (response.data == null) {
                        this.faultyResponse = true;
                    }
                    else {
                        let data = response.data;
                        this.user.name = data.name;
                        this.user.run_tokens = data.run_tokens;
                        this.token = data.id;
                        this.faultyResponse = false;
                    }
                }
            )
            this.token = userToken;
            this.user.name = "TestName";
            this.user.run_tokens = ["a4adas1", "6fjas4a"]
        },
        getRunData() {
            // we would like to have this for each token instead for one single token
            axios.get("http://localhost:8000/test/trace/all/").then(
                response => {
                    console.log(response);
                }
            )
        }
    }
});
</script>

<template>
 <div class="app">
     <div class="input-group mb-3">
         <span class="input-group-text" id="basic-addon1">Token:</span>
         <input v-model="entered_token" type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
         <button @click="getUserData(this.entered_token)" class="btn btn-outline-secondary" type="button">Show</button>

     </div>

     <div class="alert alert-secondary" role="alert" v-if="!faultyResponse">
         <p>UserToken: {{token}}</p>
         <p>Name: {{user.name}}</p>
         <br>
         <ul>
             Token:
             <li v-for="token in user.run_tokens">{{token}} <button @click="getRunData()">GetRunData # shows all</button></li>
         </ul>
        <p v-if="runData != null">{{runData}}</p>
     </div>
     <div v-else>
         <p>There is no user for token id: {{this.entered_token}}</p>
     </div>
 </div>
</template>

<style scoped>
p {
    color: white;
}
.grey-p{
    color: #b9c8f4;
}
</style>


