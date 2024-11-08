# FightPick - UFC Fight Analysis Tool

A web application that analyzes UFC fights using AI and provides betting recommendations.

## Prerequisites

- Node.js (v14 or higher)
- Ollama AI installed locally
- npm or yarn package manager

## Installation

1. Clone the repository:

git clone 

    cd server
 
    run npm i 

to start the server run
    in a new terminal
    npm run dev 
 
 cd fight-app
    run npm i 

to start ollana run 
    in a new terminal
    ollama run llama2 
 
    

to run the whole app in docker container 

run docker-compose up 

commad to see the database 

docker exec -it fight-app-db psql -U postgres -d fightpick_db

\dt to see the tables 

to see the ollama docker container  and the version of ollama

docker ps 

docker exec f7440360af1e ollama --version

start ollama server 

ollama server in another terminal 