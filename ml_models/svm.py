import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC, SVR
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_squared_error
from pre_traitement.clean import detect_target_column

# Fonction pour encoder les données catégorielles
def encode_data(data):
    for column in data.select_dtypes(include=['object']).columns:
        le = LabelEncoder()
        data[column] = le.fit_transform(data[column])
    return data

# Fonction pour normaliser les données
def normalize_data(data):
    scaler = StandardScaler()
    numerical_columns = data.select_dtypes(include=['float64', 'int64']).columns
    data[numerical_columns] = scaler.fit_transform(data[numerical_columns])
    return data

def preprocess_data(data):
    # Copy data to avoid modifying original
    data = data.copy()
    
    # Encode and normalize
    data = encode_data(data)
    data = normalize_data(data)
    
    # Detect target and problem type
    target_column, _ = detect_target_column(data)
    
    if not target_column:
        print("Impossible de détecter une colonne cible.")
        return None, None, None, None
        
    # Determine problem type based on unique values
    n_unique = len(data[target_column].unique())
    problem_type = "classification" if n_unique <= 10 else "regression"
    
    X = data.drop(columns=[target_column])
    y = data[target_column]
    
    # Convert target to int for classification
    if problem_type == "classification":
        y = y.astype(int)
    
    return X, y, target_column, problem_type

# Fonction pour appliquer SVM avec tous les noyaux

def svm_all_kernels(X_train, y_train, X_test, y_test, problem_type):
    kernels = ["linear", "poly", "rbf", "sigmoid"]
    results = []
    
    for kernel in kernels:
        try:
            print(f"\n--- SVM avec le noyau : {kernel} ---")
            
            if problem_type == "classification":
                model = SVC(kernel=kernel, random_state=42)
                metric_name = "Accuracy"
            else:
                model = SVR(kernel=kernel)
                metric_name = "MSE"
                
            model.fit(X_train, y_train)
            y_pred_train = model.predict(X_train)
            y_pred_test = model.predict(X_test)
            
            if problem_type == "classification":
                train_metric = accuracy_score(y_train, y_pred_train)
                test_metric = accuracy_score(y_test, y_pred_test)
            else:
                train_metric = mean_squared_error(y_train, y_pred_train)
                test_metric = mean_squared_error(y_test, y_pred_test)
                
            print(f"{metric_name} (Train) : {train_metric:.2f}")
            print(f"{metric_name} (Test) : {test_metric:.2f}")
            
            results.append({
                "kernel": kernel,
                "train_metric": train_metric,
                "test_metric": test_metric
            })
            
        except Exception as e:
            print(f"Erreur avec le noyau {kernel}: {str(e)}")
            continue
            
    return results

def SVM(data):
    # Prétraiter les données
    X, y, target_column, problem_type = preprocess_data(data)

    if X is None or y is None or problem_type is None:
        print("Les données ne sont pas adaptées pour le modèle SVM.")
        return

    print(f"Colonne cible détectée : {target_column}")
    print(f"Type de problème détecté : {problem_type}")

    # Diviser les données en ensembles d'entraînement et de test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

    # Exécuter le modèle SVM avec tous les noyaux
    print("\nExécution du modèle SVM avec tous les noyaux disponibles...")
    results = svm_all_kernels(X_train, y_train, X_test, y_test, problem_type)

    # Find best performing kernel based on test metrics
    best_result = max(results, key=lambda x: x['test_metric'])
    
    # Format return value as expected by API (metric, params)
    metric = best_result['test_metric']
    params = {'best_kernel': best_result['kernel']}

    # Print results for logging
    print("\n--- Résultats pour tous les noyaux ---")
    for result in results:
        kernel = result["kernel"]
        train_metric = result["train_metric"]
        test_metric = result["test_metric"]
        print(f"Noyau : {kernel} | Train Metric : {train_metric:.2f} | Test Metric : {test_metric:.2f}")

    return metric, params