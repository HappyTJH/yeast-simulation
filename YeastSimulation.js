import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';

const YeastSimulation = () => {
  const [isPaused, setIsPaused] = useState(true);
  const [timeStep, setTimeStep] = useState(0);
  const [stats, setStats] = useState({
    totalCells: 1,
    visibleCells: 0,
    avgLength: 0,
    growthRate: 0
  });
  const [environment, setEnvironment] = useState({
    oxygen: 80,
    temperature: 30
  });

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const cellsRef = useRef([]);
  const totalCellCountRef = useRef(1);
  const MAX_VISIBLE_CELLS = 100;  // 增加到100个可见细胞
  const MAX_TOTAL_CELLS = 450000;
  const MAX_LENGTH_RATIO = 2.0;

  const calculateCellLength = (oxygen) => {
    if (oxygen >= 20) {
      return 1.0;  // 需氧条件：完全圆形
    } else {
      const lengthIncrease = (20 - oxygen) / 20 * (MAX_LENGTH_RATIO - 1.0);
      return Math.min(1.0 + lengthIncrease, MAX_LENGTH_RATIO);
    }
  };

  useEffect(() => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.z = 35;  // 调整相机距离以适应更多细胞

    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current,
      antialias: true 
    });
    rendererRef.current = renderer;
    renderer.setSize(400, 400);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    addInitialCell();

    const animate = () => {
      requestAnimationFrame(animate);
      if (!isPaused) {
        cellsRef.current.forEach(cell => {
          cell.rotation.x += 0.01;
          cell.rotation.y += 0.01;
        });
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      scene.clear();
      renderer.dispose();
    };
  }, []);

  const createYeastCell = (position, oxygen) => {
    const length = calculateCellLength(oxygen);
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    geometry.scale(length, 1, 1);
    
    const material = new THREE.MeshPhongMaterial({
      color: 0xff9966,
      specular: 0x555555,
      shininess: 30,
      transparent: true,
      opacity: 0.9
    });

    const cell = new THREE.Mesh(geometry, material);
    
    if (position) {
      cell.position.copy(position);
    } else {
      // 在更大的空间范围内随机分布细胞
      cell.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 10
      );
    }
    
    cell.rotation.x = Math.random() * Math.PI;
    cell.rotation.y = Math.random() * Math.PI;
    cell.rotation.z = Math.random() * Math.PI;

    cell.userData = {
      growthStage: 0,
      dividing: false,
      createdAtOxygen: oxygen,
    };

    return cell;
  };

  const addInitialCell = () => {
    const cell = createYeastCell(new THREE.Vector3(0, 0, 0), environment.oxygen);
    sceneRef.current.add(cell);
    cellsRef.current = [cell];
    totalCellCountRef.current = 1;
    updateStats();
  };

  const manageVisibleCells = () => {
    const scene = sceneRef.current;
    
    while (cellsRef.current.length > MAX_VISIBLE_CELLS) {
      const oldestCell = cellsRef.current[0];
      scene.remove(oldestCell);
      cellsRef.current.shift();
    }
  };

  const divideCellProcess = (parentCell) => {
    if (parentCell.userData.dividing) return;
    parentCell.userData.dividing = true;

    const newCell = createYeastCell(null, environment.oxygen);
    
    if (cellsRef.current.length < MAX_VISIBLE_CELLS) {
      sceneRef.current.add(newCell);
      cellsRef.current.push(newCell);
    }

    // 更平滑地增加总细胞数
    const growthIncrement = calculateGrowthRate() / 100;
    totalCellCountRef.current = Math.min(
      Math.ceil(totalCellCountRef.current * (1 + growthIncrement)),
      MAX_TOTAL_CELLS
    );

    const angle = Math.random() * Math.PI * 2;
    const separationDistance = 3;
    let progress = 0;

    const animate = () => {
      if (progress >= 1) {
        parentCell.userData.dividing = false;
        parentCell.userData.growthStage = 0;
        updateStats();
        return;
      }

      progress += 0.02;  // 减慢分裂动画速度
      
      if (newCell.parent) {
        newCell.position.x = parentCell.position.x + Math.cos(angle) * separationDistance * progress;
        newCell.position.y = parentCell.position.y + Math.sin(angle) * separationDistance * progress;
        newCell.position.z = parentCell.position.z;
      }

      requestAnimationFrame(animate);
    };

    animate();
    manageVisibleCells();
  };

  const updateStats = () => {
    const visibleCells = cellsRef.current.length;
    const avgLength = cellsRef.current.reduce((sum, cell) => 
      sum + cell.scale.x, 0) / visibleCells;

    setStats({
      totalCells: totalCellCountRef.current,
      visibleCells,
      avgLength: avgLength.toFixed(2),
      growthRate: calculateGrowthRate()
    });
  };

  const calculateGrowthRate = () => {
    const baseRate = 0.15;  // 降低基础生长率
    const timeMultiplier = Math.min(timeStep / 200, 3);  // 减缓时间对生长率的影响
    const oxygenEffect = environment.oxygen < 20 ? 0.8 : 1;  // 调整氧气影响
    const temperatureEffect = Math.exp(-Math.pow(environment.temperature - 30, 2) / 100);
    return ((baseRate * (1 + timeMultiplier) * oxygenEffect * temperatureEffect) * 100).toFixed(2);
  };

  useEffect(() => {
    let interval;
    if (!isPaused) {
      interval = setInterval(() => {
        setTimeStep(prev => prev + 1);
        
        cellsRef.current.forEach(cell => {
          if (!cell.userData.dividing) {
            cell.userData.growthStage += calculateGrowthRate() / 2000;  // 减慢生长速度
            
            if (cell.userData.growthStage >= 1) {
              divideCellProcess(cell);
            }
          }
        });

        // 根据环境条件调整现有细胞的形状
        cellsRef.current.forEach(cell => {
          const targetLength = calculateCellLength(environment.oxygen);
          cell.scale.x += (targetLength - cell.scale.x) * 0.1;
        });

        updateStats();
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPaused, environment]);

  const handleReset = () => {
    cellsRef.current.forEach(cell => {
      sceneRef.current.remove(cell);
    });
    cellsRef.current = [];
    totalCellCountRef.current = 1;
addInitialCell();
    setTimeStep(0);
    setIsPaused(true);
  };

  return (
    <div className="w-full max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>3D酵母生长模拟</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Button 
              onClick={() => setIsPaused(!isPaused)}
              className="w-24"
            >
              {isPaused ? '开始' : '暂停'}
            </Button>
            <Button 
              onClick={handleReset}
              className="w-24"
            >
              重置
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-2">氧气浓度: {environment.oxygen}%</div>
              <input
                type="range"
                value={environment.oxygen}
                onChange={(e) => setEnvironment(prev => ({...prev, oxygen: parseInt(e.target.value)}))}
                min={0}
                max={100}
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-2">温度: {environment.temperature}°C</div>
              <input
                type="range"
                value={environment.temperature}
                onChange={(e) => setEnvironment(prev => ({...prev, temperature: parseInt(e.target.value)}))}
                min={20}
                max={40}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-4">
            <div className="flex justify-center items-center bg-gray-100 rounded-lg p-4">
              <canvas 
                ref={canvasRef} 
                className="rounded-lg"
                style={{ width: '400px', height: '400px' }}
              />
            </div>

            <div className="p-4 bg-white rounded-lg shadow">
              <div className="text-sm space-y-2">
                <div className="font-bold mb-2">实时统计数据:</div>
                <div>实际总细胞数: {stats.totalCells.toLocaleString()}</div>
                <div>可见细胞数: {stats.visibleCells}</div>
                <div>生长速率: {stats.growthRate}%</div>
                <div>时间步长: {timeStep}</div>
                {environment.oxygen < 20 ? 
                  <div className="text-blue-600">厌氧条件: 新生成的细胞呈现伸长状态</div> :
                  <div className="text-green-600">需氧条件: 细胞保持圆形</div>
                }
                {Math.abs(environment.temperature - 30) > 5 &&
                  <div className="text-yellow-600">温度偏离最适范围，生长受限</div>
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default YeastSimulation;